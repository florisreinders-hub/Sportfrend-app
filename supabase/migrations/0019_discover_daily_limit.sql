-- Enforces the daily recommendation limits shown on the Pricing screen
-- (PricingScreen.tsx) server-side: Basis = 5 nieuwe profielen/dag, Premium
-- = 15/dag, Elite = onbeperkt. Until now `subscriptions.plan` was only
-- ever written (on "purchase") and read back for the GDPR data export -
-- nothing anywhere actually limited what a Basis/Premium user could do
-- differently from an Elite one. This is genuinely server-side (inside
-- discover_profiles(), the only path Ontdekken uses to fetch candidates,
-- and RLS-blocked from being tampered with client-side) so it can't be
-- bypassed by a hand-crafted API call the way a client-side counter could.
--
-- Run this via `supabase db push` or paste into the Supabase SQL editor.
-- Safe to run more than once. 0001_init.sql has been updated to match for
-- fresh installs.

-- ─────────────────────────────────────────────────────────────────────────
-- discover_daily_views: which profiles a user has already been shown
-- today. This is deliberately separate from `swipes` - a profile shown
-- but not yet swiped on (still sitting on top of the card stack) must
-- keep counting as "already shown" on every re-fetch (HomeScreen refetches
-- discover_profiles() on every Ontdekken tab focus, see useFocusEffect),
-- otherwise merely switching tabs and back would burn through the whole
-- daily quota on cards the user hasn't even acted on yet. Only a profile
-- id genuinely new to today's date consumes one unit of the daily limit.
-- ─────────────────────────────────────────────────────────────────────────
create table if not exists public.discover_daily_views (
  user_id uuid not null references public.profiles (id) on delete cascade,
  profile_id uuid not null references public.profiles (id) on delete cascade,
  view_date date not null default current_date,
  created_at timestamptz not null default now(),
  primary key (user_id, profile_id, view_date)
);

alter table public.discover_daily_views enable row level security;

-- No insert/update/delete policy for `authenticated` at all, deliberately:
-- every write happens inside discover_profiles() below (SECURITY DEFINER,
-- runs as the function owner, which isn't subject to this RLS). A user
-- being able to insert/delete their own rows here would let them reset or
-- fabricate their own "already shown" history and dodge the daily limit
-- entirely - RLS defaulting to deny (no applicable policy) is what makes
-- this actually server-side enforcement, not just a client-visible counter.
drop policy if exists "Users can read their own discover view history" on public.discover_daily_views;
create policy "Users can read their own discover view history"
  on public.discover_daily_views for select
  to authenticated
  using (auth.uid() = user_id);

-- ─────────────────────────────────────────────────────────────────────────
-- discover_plan_daily_limit: single source of truth for what each plan's
-- daily limit actually is, shared by discover_profiles() and
-- discover_daily_status() below so the two can't silently drift apart.
-- null return value means "unlimited" (Elite).
-- ─────────────────────────────────────────────────────────────────────────
create or replace function public.discover_plan_daily_limit(p_plan text)
returns int
language sql
immutable
as $$
  select case p_plan
    when 'premium' then 15
    when 'elite' then null
    else 5 -- 'basis', and the fallback for a user with no active subscription row at all
  end;
$$;

-- ─────────────────────────────────────────────────────────────────────────
-- discover_daily_status: lets the client show a clear "daily limit
-- reached" message (with an upgrade link) distinctly from "no candidates
-- match your filters" - discover_profiles() alone can't tell those two
-- apart from an empty result set. SECURITY DEFINER + auth.uid()-scoped for
-- the same reason as get_my_location()/discover_profiles(): the caller
-- can only ever see their own status, never query someone else's by id.
-- ─────────────────────────────────────────────────────────────────────────
create or replace function public.discover_daily_status()
returns table (plan text, daily_limit int, used_today int, remaining int)
language plpgsql
security definer
set search_path = public
stable
as $$
declare
  v_uid uuid := auth.uid();
  v_plan text;
  v_daily_limit int;
  v_used_today int;
begin
  if v_uid is null then
    raise exception 'Not authenticated';
  end if;

  -- Only a genuinely *active* subscription counts - a "pending" plan
  -- (selected on the Pricing screen but never actually "paid", see
  -- selectPendingPlan in lib/api.ts) must not unlock a higher limit, and
  -- a user who never touched the Pricing screen at all has no row here -
  -- both cases fall back to "basis".
  select s.plan into v_plan
  from public.subscriptions s
  where s.user_id = v_uid and s.status = 'active';

  v_plan := coalesce(v_plan, 'basis');
  v_daily_limit := public.discover_plan_daily_limit(v_plan);

  if v_daily_limit is not null then
    select count(*) into v_used_today
    from public.discover_daily_views d
    where d.user_id = v_uid and d.view_date = current_date;
  end if;

  return query select
    v_plan,
    v_daily_limit,
    v_used_today,
    case when v_daily_limit is null then null else greatest(v_daily_limit - coalesce(v_used_today, 0), 0) end;
end;
$$;

grant execute on function public.discover_plan_daily_limit(text) to authenticated;
grant execute on function public.discover_daily_status() to authenticated;
-- No explicit table-level grant for discover_daily_views here, same as
-- every other public-schema table in this project (profiles, swipes,
-- matches, ...) - Supabase's own project bootstrap already grants table
-- privileges on the public schema to `authenticated` by default. RLS
-- above is the actual boundary: it exposes select only, so insert stays a
-- no-op for anyone but the SECURITY DEFINER functions below, which bypass
-- RLS as the table owner.

-- ─────────────────────────────────────────────────────────────────────────
-- discover_profiles: same candidate logic as
-- 0016_discover_profiles_no_implicit_defaults.sql, with the daily limit
-- enforced in two extra steps - resolve how many *new* (never-shown-today)
-- candidates the caller may still see, record exactly those as shown, then
-- let both those and any already-shown-but-unswiped candidates through the
-- normal filtered/ordered/distance query as before.
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

  if p_max_age is not null then
    v_min_birthdate := (current_date - (p_max_age || ' years')::interval)::date;
    v_max_birthdate := (current_date - interval '18 years')::date;
  end if;

  select s.plan into v_plan
  from public.subscriptions s
  where s.user_id = v_uid and s.status = 'active';

  v_daily_limit := public.discover_plan_daily_limit(coalesce(v_plan, 'basis'));

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
    (v_my_lat is null or v_my_lng is null or p_distance_km is null)
    or (w.distance_km is not null and w.distance_km <= p_distance_km)
  order by (case when w.distance_km is null then 1 else 0 end), w.distance_km asc nulls last
  limit p_limit;
end;
$$;

grant execute on function public.discover_profiles(text, text, int, double precision, int) to authenticated;
