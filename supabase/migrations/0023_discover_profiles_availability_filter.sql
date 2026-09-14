-- Adds "Slimme beschikbaarheids match" (Pricing screen, Elite-only): a new
-- Filter-screen option letting the viewer pick weekday(s)
-- (profiles.availability_days keys - WEEKDAY_OPTIONS, lib/api.ts) and only
-- see Ontdekken candidates whose own availability_days overlaps with at
-- least one of the picked days. Enforced inside discover_profiles()
-- itself, same pattern as the other plan-gated filters
-- (0021_discover_profiles_plan_filters.sql): a disallowed value is
-- clamped/ignored for a non-Elite caller, not rejected.
--
-- IMPORTANT signature change: this adds a 6th parameter
-- (p_availability_days) to discover_profiles(). Postgres identifies a
-- function by its full parameter type list, so `create or replace` with
-- an added parameter does NOT replace the old 5-parameter version - it
-- creates a SECOND, overloaded function alongside it, which then makes
-- every call with only the original 5 arguments ambiguous ("is not
-- unique") until the stale 5-arg version is removed. The explicit `drop
-- function` below is therefore required, not optional - skipping it
-- would leave two overloads and break any caller still on the old
-- 5-argument call shape (e.g. a client that hasn't picked up this
-- update yet) with a hard error instead of silently ignoring the new
-- parameter. Verified locally: after the drop, both a 5-arg and a 6-arg
-- call resolve unambiguously via the new function's default on
-- p_availability_days.
--
-- Run this via `supabase db push` or paste into the Supabase SQL editor.
-- Safe to run more than once (the whole function body has `create or
-- replace`; only the drop-then-recreate list changed, and `drop function
-- if exists` is itself idempotent).
--
-- ─────────────────────────────────────────────────────────────────────────
-- Verify after applying:
-- ─────────────────────────────────────────────────────────────────────────
-- select
--   (select count(*) from pg_proc where proname = 'discover_profiles'
--      and pronamespace = 'public'::regnamespace) as overload_count,
--   (select count(*) from pg_proc where proname = 'discover_profiles'
--      and pronamespace = 'public'::regnamespace
--      and pg_get_function_identity_arguments(oid) ilike '%p_availability_days%') as has_availability_param,
--   (select prosrc ilike '%availability_days && p_availability_days%' from pg_proc
--      where proname = 'discover_profiles' and pronamespace = 'public'::regnamespace
--      and pg_get_function_identity_arguments(oid) ilike '%p_availability_days%') as has_overlap_check,
--   (select prosrc ilike '%v_plan <> ''elite''%' from pg_proc
--      where proname = 'discover_profiles' and pronamespace = 'public'::regnamespace
--      and pg_get_function_identity_arguments(oid) ilike '%p_availability_days%') as has_elite_clamp;
-- -- expect: 1, 1, true, true (overload_count must be exactly 1 - if it's 2,
-- -- the old 5-arg version is still around and every 5-arg caller will now
-- -- get "is not unique" errors; re-run this file, the drop below fixes it)

drop function if exists public.discover_profiles(text, text, int, double precision, int);

create or replace function public.discover_profiles(
  p_sport text default null,
  p_level text default null,
  p_max_age int default null,
  p_distance_km double precision default null,
  p_limit int default 20,
  p_availability_days text[] default null
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

  -- "Slimme beschikbaarheids match" is Elite-only - Basis AND Premium
  -- both get it ignored, not just Basis.
  if v_plan <> 'elite' then
    p_availability_days := null;
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
        and (p_availability_days is null or p.availability_days && p_availability_days)
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
      and (p_availability_days is null or p.availability_days && p_availability_days)
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

grant execute on function public.discover_profiles(text, text, int, double precision, int, text[]) to authenticated;

-- ─────────────────────────────────────────────────────────────────────────
-- Self-check: raises a specific error instead of an ambiguous "Success" -
-- same reasoning/shape as the block added to 0022_posts_premium_only.sql
-- after a report where a migration's SQL editor "Success" didn't match
-- what a separate verification query found afterwards.
-- ─────────────────────────────────────────────────────────────────────────
do $$
declare
  v_new_oid oid;
  v_overload_count int;
begin
  select count(*) into v_overload_count
  from pg_proc where proname = 'discover_profiles' and pronamespace = 'public'::regnamespace;

  if v_overload_count <> 1 then
    raise exception 'Expected exactly 1 discover_profiles overload, found %. The old 5-argument version was not dropped - every 5-argument caller (e.g. a client on a previous app update) will now get "is not unique" errors. Re-run this file.', v_overload_count;
  end if;

  select oid into v_new_oid
  from pg_proc
  where proname = 'discover_profiles' and pronamespace = 'public'::regnamespace
    and pg_get_function_identity_arguments(oid) ilike '%p_availability_days%';

  if v_new_oid is null then
    raise exception 'discover_profiles() does not have a p_availability_days parameter - the CREATE OR REPLACE FUNCTION above did not run (or ran against a different database than this check).';
  end if;

  if not (select prosrc ilike '%availability_days && p_availability_days%' from pg_proc where oid = v_new_oid) then
    raise exception 'discover_profiles() has p_availability_days but is missing the overlap check (availability_days && p_availability_days).';
  end if;

  if not (select prosrc ilike '%v_plan <> ''elite''%' from pg_proc where oid = v_new_oid) then
    raise exception 'discover_profiles() is missing the Elite-only clamp on p_availability_days.';
  end if;

  raise notice 'discover_profiles() has exactly one overload, with p_availability_days correctly wired to the overlap check and the Elite-only clamp.';
end $$;
