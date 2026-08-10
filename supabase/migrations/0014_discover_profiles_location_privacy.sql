-- Location privacy: profiles.latitude/longitude (exact GPS coordinates)
-- were readable raw by any authenticated user who could read that profile
-- at all - i.e. almost everyone, since the "Profiles are readable by
-- authenticated users" policy is broad by design. Ontdekken
-- (fetchDiscoverProfiles, lib/api.ts) fetched every candidate's raw
-- coordinates to the client and computed distance there, which is what
-- exposed them - and once a raw select("*")-style query included those
-- columns, nothing stopped a hand-crafted API call from reading anyone's
-- exact location directly, matched or not, radius or not.
--
-- Fix: exact coordinates are no longer readable via a plain column read
-- at all, for anyone - not other users, not even the profile owner. Two
-- new SECURITY DEFINER functions are the only way to get at them:
--   - get_my_location(): the caller's own coordinates only (auth.uid()).
--   - discover_profiles(...): computes distance_km server-side from the
--     caller's own coordinates and returns that number - never anyone
--     else's raw latitude/longitude - replacing the client-side haversine
--     math fetchDiscoverProfiles used to do on raw columns.
--
-- Run this via `supabase db push` or paste into the Supabase SQL editor.
-- Safe to run more than once. 0001_init.sql has been updated to match for
-- fresh installs.

-- ─────────────────────────────────────────────────────────────────────────
-- 1. Revoke column-level SELECT on latitude/longitude for everyone
-- ─────────────────────────────────────────────────────────────────────────
revoke select on public.profiles from authenticated;
grant select (
  id, full_name, birthdate, gender, bio, sport, level, city,
  search_radius_km, avatar_url, photo_url, is_onboarded, push_notifications_enabled,
  profile_visible, availability_days, created_at, updated_at
) on public.profiles to authenticated;

-- ─────────────────────────────────────────────────────────────────────────
-- 2. get_my_location(): the owner's own exact coordinates only
-- ─────────────────────────────────────────────────────────────────────────
create or replace function public.get_my_location()
returns table (latitude double precision, longitude double precision, city text)
language sql
security definer
set search_path = public
stable
as $$
  select p.latitude, p.longitude, p.city
  from public.profiles p
  where p.id = auth.uid()
$$;

grant execute on function public.get_my_location() to authenticated;

-- ─────────────────────────────────────────────────────────────────────────
-- 3. discover_profiles(...): the Ontdekken feed, distance computed
--    server-side - never returns anyone's raw coordinates
-- ─────────────────────────────────────────────────────────────────────────
create or replace function public.discover_profiles(
  p_sport text default null,
  p_level text default null,
  p_max_age int default null,
  p_distance_km double precision default null,
  p_limit int default 20
)
returns table (
  id uuid,
  full_name text,
  birthdate date,
  gender text,
  bio text,
  sport text,
  level text,
  city text,
  search_radius_km int,
  avatar_url text,
  photo_url text,
  distance_km double precision
)
language plpgsql
security definer
set search_path = public
stable
as $$
declare
  v_uid uuid := auth.uid();
  v_my_sport text;
  v_my_lat double precision;
  v_my_lng double precision;
  v_my_radius_km double precision;
  v_sport text;
  v_radius_km double precision;
  v_min_birthdate date;
  v_max_birthdate date;
begin
  if v_uid is null then
    raise exception 'Not authenticated';
  end if;

  select p.sport, p.latitude, p.longitude, p.search_radius_km
    into v_my_sport, v_my_lat, v_my_lng, v_my_radius_km
  from public.profiles p
  where p.id = v_uid;

  v_sport := coalesce(p_sport, v_my_sport);
  v_radius_km := coalesce(p_distance_km, v_my_radius_km);

  if p_max_age is not null then
    v_min_birthdate := (current_date - (p_max_age || ' years')::interval)::date;
    v_max_birthdate := (current_date - interval '18 years')::date;
  end if;

  return query
  with candidates as (
    select p.*
    from public.profiles p
    where p.id <> v_uid
      and p.profile_visible = true
      and not exists (select 1 from public.swipes s where s.swiper_id = v_uid and s.swiped_id = p.id)
      and not exists (
        select 1 from public.blocks b
        where (b.blocker_id = v_uid and b.blocked_id = p.id)
           or (b.blocker_id = p.id and b.blocked_id = v_uid)
      )
      and (v_sport is null or p.sport = v_sport)
      and (p_level is null or p.level = p_level)
      and (v_min_birthdate is null or p.birthdate >= v_min_birthdate)
      and (v_max_birthdate is null or p.birthdate <= v_max_birthdate)
    limit 50
  ),
  with_distance as (
    select
      c.id, c.full_name, c.birthdate, c.gender, c.bio, c.sport, c.level, c.city,
      c.search_radius_km, c.avatar_url, c.photo_url,
      case
        when v_my_lat is not null and v_my_lng is not null and c.latitude is not null and c.longitude is not null
        then 6371 * 2 * asin(least(1.0, sqrt(
               sin(radians((c.latitude - v_my_lat) / 2)) ^ 2
               + cos(radians(v_my_lat)) * cos(radians(c.latitude))
               * sin(radians((c.longitude - v_my_lng) / 2)) ^ 2
             )))
        else null
      end as distance_km
    from candidates c
  )
  select w.id, w.full_name, w.birthdate, w.gender, w.bio, w.sport, w.level, w.city,
         w.search_radius_km, w.avatar_url, w.photo_url, w.distance_km
  from with_distance w
  where
    (v_my_lat is null or v_my_lng is null or v_radius_km is null)
    or (w.distance_km is not null and w.distance_km <= v_radius_km)
  order by (case when w.distance_km is null then 1 else 0 end), w.distance_km asc nulls last
  limit p_limit;
end;
$$;

grant execute on function public.discover_profiles(text, text, int, double precision, int) to authenticated;
