-- Hardening (niet een gevraagde functionele wijziging): is_moderator()
-- (0029_moderation_dashboard.sql) deed een exacte, hoofdlettergevoelige
-- vergelijking (`email = 'floris.reinders@gmail.com'`). Als het opgeslagen
-- e-mailadres in auth.users ooit met een andere hoofdlettering is
-- vastgelegd dan het hardcoded adres hier, faalt die vergelijking
-- stilletjes - geen foutmelding, de "Moderatie"-rij verschijnt gewoon
-- nooit (en de RLS-policies zouden voor dat account net zo goed niets
-- teruggeven). Deze migratie maakt de vergelijking hoofdletter-
-- ongevoelig aan beide kanten (database én client, zie
-- app/settings/SettingsScreen.tsx), zodat deze specifieke stille
-- faalmodus is uitgesloten.
--
-- Run dit via `supabase db push` of plak het in de Supabase SQL editor.
-- Veilig om vaker te draaien (`create or replace function`).
--
-- ─────────────────────────────────────────────────────────────────────────
-- Verify na het draaien:
-- ─────────────────────────────────────────────────────────────────────────
-- select pg_get_functiondef('public.is_moderator()'::regprocedure) ilike '%lower(%' as is_case_insensitive;
-- -- verwacht: true
--
-- Bevestig ook de exacte, huidige schrijfwijze van je eigen e-mailadres in
-- auth.users (nuttig om de vorige "Moderatie" niet zichtbaar"-vraag mee af
-- te sluiten):
-- select email from auth.users where lower(email) = lower('floris.reinders@gmail.com');
-- ─────────────────────────────────────────────────────────────────────────

create or replace function public.is_moderator()
returns boolean
language sql
security definer
set search_path = public, auth
stable
as $$
  select exists (
    select 1 from auth.users
    where id = auth.uid()
      and lower(email) = lower('floris.reinders@gmail.com')
  );
$$;

do $$
begin
  if not exists (select 1 from pg_proc where proname = 'is_moderator' and pronamespace = 'public'::regnamespace) then
    raise exception 'is_moderator() bestaat niet.';
  end if;

  if pg_get_functiondef('public.is_moderator()'::regprocedure) not ilike '%lower(%' then
    raise exception 'is_moderator() gebruikt geen lower() - de hoofdletter-ongevoelige vergelijking lijkt niet toegepast.';
  end if;

  raise notice 'is_moderator() vergelijkt het e-mailadres nu hoofdletter-ongevoelig.';
end $$;
