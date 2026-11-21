-- Vereenvoudigt het pakketmodel naar twee zichtbare pakketten: Basis
-- (gratis) en Premium (betaald). Geen nieuwe functionaliteit - puur
-- welke bestaande limieten/filters/functies bij welk plan horen.
--
-- 1. Berichten: onbeperkt voor alle plannen (was al onbeperkt voor
--    premium/elite, nu ook voor basis - messages_plan_daily_limit()).
-- 2. Ontdekken: Basis van 5 naar 10 aanbevelingen/dag; Premium gaat van
--    15/dag naar onbeperkt (matcht Elite) - discover_plan_daily_limit().
-- 3. Ontdekken-filters: Basis mag nu ook het Niveau-filter gebruiken
--    (naast Sport en Afstand tot 50km) - discover_profiles(). Leeftijd,
--    Afstand tot 150km en "Slimme beschikbaarheids match" blijven
--    Premium(+Elite)-only.
-- 4. Elite samengevoegd met Premium: has_elite_access() geeft nu ook
--    true voor een actief premium-abonnement, dus Premium krijgt de
--    Trainings & Buddy Planner en de Slimme beschikbaarheids match
--    erbij. De bijbehorende RLS-policy op trainings (INSERT) wordt
--    hernoemd van "Elite match participants..." naar "Premium match
--    participants...", maar blijft verder ongewijzigd: hij roept nog
--    steeds has_elite_access() aan, dat is de enige échte wijziging.
--
-- 'elite' blijft een geldige waarde in public.subscriptions.plan (de
-- check-constraint in 0001_init.sql noemt 'basis'/'premium'/'elite' en
-- wordt hier niet aangeraakt) - bestaande rijen met plan = 'elite'
-- blijven gewoon werken en krijgen via has_elite_access() dezelfde
-- toegang als een actieve premium-rij. has_posts_access() (het
-- prikbord) en de RLS-policies zelf zijn met opzet NIET aangepast: die
-- stonden al op "premium of elite" en blijven dat.
--
-- 0001-0039 blijven ongewijzigd behalve 0001_init.sql, waarvan het
-- "fresh install"-eindbeeld hieronder is meebijgewerkt zodat een nieuwe
-- installatie dit niet alsnog via een losse migratie hoeft te krijgen -
-- zie README.md's "Lokaal draaien"-sectie: alle migraties draaien
-- sowieso in bestandsvolgorde, dus deze file is de enige die iets
-- *verandert*.
--
-- Draai dit via `supabase db push` of plak het in de Supabase SQL
-- editor. Veilig om vaker te draaien (CREATE OR REPLACE FUNCTION/ALTER
-- POLICY RENAME zijn idempotent, op de policy-rename na - de
-- zelfcontrole hieronder behandelt een al-hernoemde policy niet als
-- fout).

begin;

-- 1. Berichten onbeperkt voor alle plannen (was: basis 3, rest null).
create or replace function public.messages_plan_daily_limit(p_plan text)
returns int
language sql
immutable
as $$
  select null::int; -- onbeperkt chatten voor elk plan - zie 0040_basis_premium_plan_simplification.sql
$$;

-- 2. Ontdekken: basis 5 -> 10/dag; premium 15/dag -> onbeperkt (matcht elite).
create or replace function public.discover_plan_daily_limit(p_plan text)
returns int
language sql
immutable
as $$
  select case p_plan
    when 'basis' then 10
    else null -- 'premium' en 'elite': onbeperkt - zie 0040_basis_premium_plan_simplification.sql
  end;
$$;

-- 3. discover_profiles(): Basis mag nu ook het Niveau-filter gebruiken
-- (p_level wordt niet meer genuld voor basis); Leeftijd (p_max_age) en
-- Afstand tot 150km blijven premium(+elite)-only. "Slimme
-- beschikbaarheids match" (p_availability_days) was elite-only, is nu
-- premium+elite.
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

  -- Filter access per plan (Pricing screen: Basis = Sport + Afstand
  -- (max 50km) + Niveau; Premium/Elite = ook Leeftijd en Afstand tot
  -- 150km). Niveau is sinds 0040_basis_premium_plan_simplification.sql
  -- geen premium-only filter meer - alleen Leeftijd en de Afstand-cap
  -- worden nog voor Basis geclamped. Een disallowed waarde is
  -- geclamped/genegeerd, niet afgewezen - een Basis-caller die toch
  -- p_max_age of een >50km p_distance_km stuurt, krijgt dat simpelweg
  -- teruggebracht naar wat Basis mag.
  if v_plan = 'basis' then
    p_max_age := null;
    p_distance_km := least(coalesce(p_distance_km, 50), 50);
  end if;

  -- "Slimme beschikbaarheids match" was elite-only, is sinds
  -- 0040_basis_premium_plan_simplification.sql premium+elite (Elite's
  -- voordelen zijn samengevoegd met Premium) - alleen Basis krijgt dit
  -- nog genegeerd.
  if v_plan not in ('premium', 'elite') then
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
      -- (Premium/Elite), just picked as one of this call's fresh quota
      -- slots, or already shown earlier today (still allowed -
      -- re-showing an unswiped card never costs extra quota).
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

-- 4. Elite samengevoegd met Premium: has_elite_access() geeft nu ook
-- true voor een actief premium-abonnement (was: alleen 'elite'). Dit is
-- de enige échte toegangswijziging - de trainings-policies/
-- discover_profiles()'s beschikbaarheids-clamp hierboven roepen deze
-- functie niet rechtstreeks aan, maar volgen hetzelfde "premium of
-- elite"-criterium met opzet consistent.
create or replace function public.has_elite_access()
returns boolean
language plpgsql
security definer
set search_path = public
stable
as $$
declare
  v_uid uuid := auth.uid();
begin
  if v_uid is null then
    return false;
  end if;

  return exists (
    select 1 from public.subscriptions s
    where s.user_id = v_uid and s.status = 'active' and s.plan in ('premium', 'elite')
  );
end;
$$;

-- Zuiver cosmetisch: de INSERT-policy op trainings riep al
-- has_elite_access() aan (dat is de echte gate, hierboven aangepast) -
-- alleen de naam verwees nog naar "Elite" terwijl Premium er nu ook
-- onder valt.
alter policy "Elite match participants can propose trainings" on public.trainings
  rename to "Premium match participants can propose trainings";

-- ─────────────────────────────────────────────────────────────────────────
-- Zelfcontrole
-- ─────────────────────────────────────────────────────────────────────────
do $$
declare
  v_discover_src text := (select prosrc from pg_proc where oid = 'public.discover_profiles(text,text,integer,double precision,integer,text[])'::regprocedure);
  v_elite_src text := (select prosrc from pg_proc where oid = 'public.has_elite_access()'::regprocedure);
begin
  if public.messages_plan_daily_limit('basis') is not null then
    raise exception 'messages_plan_daily_limit(''basis'') moet null zijn (onbeperkt chatten) - kreeg %', public.messages_plan_daily_limit('basis');
  end if;
  if public.messages_plan_daily_limit('premium') is not null or public.messages_plan_daily_limit('elite') is not null then
    raise exception 'messages_plan_daily_limit() moet voor elk plan null blijven geven.';
  end if;

  if public.discover_plan_daily_limit('basis') is distinct from 10 then
    raise exception 'discover_plan_daily_limit(''basis'') moet 10 zijn - kreeg %', public.discover_plan_daily_limit('basis');
  end if;
  if public.discover_plan_daily_limit('premium') is not null then
    raise exception 'discover_plan_daily_limit(''premium'') moet null (onbeperkt) zijn - Premium moet nu Elite''s Ontdekken-limiet matchen.';
  end if;
  if public.discover_plan_daily_limit('elite') is not null then
    raise exception 'discover_plan_daily_limit(''elite'') moet null blijven.';
  end if;

  if v_discover_src ilike '%p_level := null%' then
    raise exception 'discover_profiles() nult p_level nog steeds voor Basis - Niveau moet nu ook voor Basis beschikbaar zijn.';
  end if;
  if v_discover_src not ilike '%v_plan not in (''premium'', ''elite'')%' then
    raise exception 'discover_profiles() lijkt de beschikbaarheids-clamp niet te hebben verbreed naar premium+elite.';
  end if;

  if v_elite_src not ilike '%''premium'', ''elite''%' then
    raise exception 'has_elite_access() controleert niet meer op zowel ''premium'' als ''elite'' - Premium zou de Trainings & Buddy Planner / Slimme beschikbaarheids match niet krijgen.';
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'trainings'
      and policyname = 'Premium match participants can propose trainings'
      and with_check ilike '%has_elite_access%'
  ) then
    raise exception 'De INSERT-policy op trainings ontbreekt, is niet hernoemd, of roept has_elite_access() niet meer aan.';
  end if;
  if exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'trainings'
      and policyname = 'Elite match participants can propose trainings'
  ) then
    raise exception 'De oude policy-naam "Elite match participants can propose trainings" bestaat nog - de rename is niet gelukt.';
  end if;

  raise notice '0040: messages/discover daily limits, discover_profiles (Basis+Niveau, Premium+beschikbaarheid), has_elite_access() en de trainings-insertpolicy staan allemaal op het nieuwe Basis/Premium-model.';
end $$;

commit;
