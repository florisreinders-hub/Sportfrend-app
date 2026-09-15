-- Fixes discover_profiles() (0014_discover_profiles_location_privacy.sql)
-- silently narrowing Ontdekken to the caller's own profile's sport/
-- search_radius_km whenever those filters were "not explicitly set" -
-- even though the Filter screen's UI, in exactly that "not set" state,
-- always displays "ALLE SPORTEN" and a concrete "NNKM" distance value,
-- never anything suggesting "your own sport" or "your own saved radius"
-- is being applied instead.
--
-- Symptom this caused: 10 freshly seeded test profiles
-- (supabase/seed/test_profiles_seed.sql), correctly saved with
-- profile_visible = true, simply never appeared in Ontdekken for the
-- tester - confirmed by reproducing the exact function logic against a
-- local Postgres instance:
--   - Sport: with the Filter screen showing "ALLE SPORTEN" (its permanent
--     default label, whether touched or not) but the tester's own
--     profile.sport set to something none of the 10 test profiles use,
--     every one of them was silently filtered out - the pill said "all
--     sports" while the query only asked for the tester's one sport.
--   - Distance: with the slider showing its default "150KM" but the
--     tester's own profile.search_radius_km still at its schema default
--     (25 - profiles.search_radius_km is never actually written by any
--     screen in the app, so this was the applied radius for literally
--     every user, always, regardless of what the slider showed), test
--     profiles seeded ~100km away (Oudheusden vs. an Amsterdam-based
--     tester) were excluded even though "150KM" was clearly displayed.
--
-- Fix: p_sport and p_distance_km are now applied exactly as passed by
-- the client - lib/api.ts's fetchDiscoverProfiles sends the Filter
-- screen's actual current values (null/"Alle sporten" really means no
-- sport filter now; whatever km the slider shows is the actual applied
-- radius), with no more implicit substitution of the caller's own
-- profile.sport/search_radius_km. profiles.search_radius_km remains in
-- the schema (still returned by this function, still documented in
-- DATA_INVENTORY.md) but is no longer read by this function - nothing
-- in the app writes to it, so relying on it never reflected an actual
-- user choice to begin with.
--
-- Run this via `supabase db push` or paste into the Supabase SQL editor.
-- Safe to run more than once (create or replace function - same
-- signature as before, no grant changes needed). 0001_init.sql has been
-- updated to match for fresh installs.

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
  v_my_lat double precision;
  v_my_lng double precision;
  v_min_birthdate date;
  v_max_birthdate date;
begin
  if v_uid is null then
    raise exception 'Not authenticated';
  end if;

  select p.latitude, p.longitude
    into v_my_lat, v_my_lng
  from public.profiles p
  where p.id = v_uid;

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
      and (p_sport is null or p.sport = p_sport)
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
    (v_my_lat is null or v_my_lng is null or p_distance_km is null)
    or (w.distance_km is not null and w.distance_km <= p_distance_km)
  order by (case when w.distance_km is null then 1 else 0 end), w.distance_km asc nulls last
  limit p_limit;
end;
$$;
