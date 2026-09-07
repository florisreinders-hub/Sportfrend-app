-- Enforces which Ontdekken filters a plan may actually use (Pricing
-- screen: Basis = "Basisfilters" i.e. only Sport + Afstand, capped at
-- 50km; Premium/Elite = "Uitgebreide filters" i.e. Sport, Afstand up to
-- 150km, Leeftijd, Niveau) inside discover_profiles() itself - the only
-- path Ontdekken uses to fetch candidates - so a Basis account can't get
-- age/level narrowing or a >50km radius via a hand-crafted RPC call that
-- skips the (client-side-only) locked UI on FilterScreen.tsx. A
-- disallowed parameter isn't rejected with an error - it's silently
-- clamped/ignored, same "correct to the allowed value" spirit as
-- 0019_discover_daily_limit.sql's daily quota, so a Basis client that
-- still happens to send p_level/p_max_age/a >50km p_distance_km (e.g. a
-- stale cached filter from before a downgrade) degrades gracefully
-- instead of erroring.
--
-- Run this via `supabase db push` or paste into the Supabase SQL editor.
-- Safe to run more than once. 0001_init.sql has been updated to match
-- for fresh installs.
--
-- ─────────────────────────────────────────────────────────────────────────
-- Verify after applying:
-- ─────────────────────────────────────────────────────────────────────────
-- select prosrc ilike '%v_plan = ''basis''%' as has_plan_filter_clamp
-- from pg_proc
-- where proname = 'discover_profiles' and pronamespace = 'public'::regnamespace;
-- -- expect: true

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
as $$
declare
  v_uid uuid := auth.uid();
  v_my_lat double precision;
  v_my_lng double precision;
  v_min_birthdate date;
  v_max_birthdate date;
  v_plan text;
  v_daily_limit int;
  v_used_today int;
  v_remaining int;
  v_new_ids uuid[];
begin
  if v_uid is null then
    raise exception 'Not authenticated';
  end if;

  select p.latitude, p.longitude
    into v_my_lat, v_my_lng
  from public.profiles p
  where p.id = v_uid;

  select s.plan into v_plan
  from public.subscriptions s
  where s.user_id = v_uid and s.status = 'active';
  v_plan := coalesce(v_plan, 'basis');

  -- Filter access per plan (Pricing screen: Basis = Sport + Afstand only,
  -- max 50km; Premium/Elite = all filters, Afstand up to 150km). A
  -- disallowed value is clamped/ignored here, not rejected - a Basis
  -- caller that sends p_level/p_max_age/a >50km p_distance_km simply gets
  -- those narrowed to what Basis is actually allowed.
  if v_plan = 'basis' then
    p_level := null;
    p_max_age := null;
    p_distance_km := least(coalesce(p_distance_km, 50), 50);
  end if;

  if p_max_age is not null then
    v_min_birthdate := (current_date - (p_max_age || ' years')::interval)::date;
    v_max_birthdate := (current_date - interval '18 years')::date;
  end if;

  v_daily_limit := public.discover_plan_daily_limit(v_plan);

  if v_daily_limit is not null then
    select count(*) into v_used_today
    from public.discover_daily_views d
    where d.user_id = v_uid and d.view_date = current_date;

    v_remaining := greatest(v_daily_limit - v_used_today, 0);

    -- Pick the closest `v_remaining` candidates the caller has never been
    -- shown today, and record them as shown - this is the one place the
    -- daily quota is actually spent. Ordering matches the final query's
    -- own "closest first" order, so the quota is spent on the same
    -- profiles that would be shown first anyway.
    select array_agg(sub.id) into v_new_ids
    from (
      select p.id,
        case
          when v_my_lat is not null and v_my_lng is not null and p.latitude is not null and p.longitude is not null
          then 6371 * 2 * asin(least(1.0, sqrt(
                 sin(radians((p.latitude - v_my_lat) / 2)) ^ 2
                 + cos(radians(v_my_lat)) * cos(radians(p.latitude))
                 * sin(radians((p.longitude - v_my_lng) / 2)) ^ 2
               )))
          else null
        end as distance_km
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
        and not exists (
          select 1 from public.discover_daily_views d
          where d.user_id = v_uid and d.profile_id = p.id and d.view_date = current_date
        )
      order by (case when distance_km is null then 1 else 0 end), distance_km asc nulls last
      limit least(v_remaining, p_limit)
    ) sub;

    if v_new_ids is not null and array_length(v_new_ids, 1) > 0 then
      insert into public.discover_daily_views (user_id, profile_id, view_date)
      select v_uid, new_id, current_date from unnest(v_new_ids) as new_id
      on conflict do nothing;
    end if;
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
      -- Only profiles genuinely allowed today: no daily limit at all
      -- (Elite), just picked as one of this call's fresh quota slots, or
      -- already shown earlier today (still allowed - re-showing an
      -- unswiped card never costs extra quota).
      and (
        v_daily_limit is null
        or (v_new_ids is not null and p.id = any(v_new_ids))
        or exists (
          select 1 from public.discover_daily_views d
          where d.user_id = v_uid and d.profile_id = p.id and d.view_date = current_date
        )
      )
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
    -- Only apply the radius cutoff when the viewer actually has a location
    -- and a radius to compare against - no location set means no
    -- distance-based narrowing at all.
    (v_my_lat is null or v_my_lng is null or p_distance_km is null)
    or (w.distance_km is not null and w.distance_km <= p_distance_km)
  order by (case when w.distance_km is null then 1 else 0 end), w.distance_km asc nulls last
  limit p_limit;
end;
$$;

grant execute on function public.discover_profiles(text, text, int, double precision, int) to authenticated;
