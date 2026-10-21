-- Herstelt het UPDATE-recht op public.profiles.expo_push_token voor
-- authenticated, voor elke omgeving waar die kolom daadwerkelijk bestaat.
--
-- Achtergrond: 0033_terms_acceptance.sql doet `revoke update on
-- public.profiles from authenticated` gevolgd door een expliciete
-- kolomlijst-grant die expo_push_token bewust NIET noemt - op de live
-- database die 0033 destijds targette bestond die kolom namelijk niet
-- (0011_push_notifications.sql is daar nooit (volledig) toegepast, zie
-- de uitleg in 0033's eigen comments). Op die database is 0033's
-- revoke/grant dus altijd correct geweest: er was nooit een UPDATE-recht
-- op expo_push_token om in te trekken.
--
-- Maar 0001_init.sql neemt expo_push_token inmiddels wél rechtstreeks op
-- in de create table-statement (mirrored voor fresh installs), én
-- verleent daar ook direct het UPDATE-recht op. Bij een volledige
-- migratie-replay vanaf nul (`supabase db reset`, of elke nieuwe
-- omgeving/kloon van dit project) bestaat de kolom dus al wanneer 0033
-- aan de beurt is - en 0033's revoke trekt dat UPDATE-recht dan weer in,
-- zonder het ooit terug te krijgen: na een volledige reset zou
-- `updateExpoPushToken()`-achtige code (het token bijwerken bij
-- app-start, zie lib/api.ts) dus stil falen op RLS/grant-niveau, ook al
-- bestaat de kolom en al staat er geen enkele RLS-policy in de weg.
--
-- Deze migratie dicht precies dat gat, voor beide databases tegelijk:
-- op de live database zonder de kolom is dit een no-op (de if-guard
-- slaat de grant dan over - een `grant update` op een niet-bestaande
-- kolom zou anders hard falen, exact de fout die 0033's eigen comments
-- als eerdere productie-incident beschrijven); op elke omgeving met de
-- kolom (fresh install, reset, of een toekomstige migratie die de kolom
-- alsnog goed toevoegt) wordt het recht (opnieuw) verleend. Veilig om
-- vaker te draaien.
--
-- ─────────────────────────────────────────────────────────────────────────
-- Controlequery (plak dit los in de SQL editor om te verifiëren):
-- ─────────────────────────────────────────────────────────────────────────
-- select
--   exists (
--     select 1 from information_schema.columns
--     where table_schema = 'public' and table_name = 'profiles' and column_name = 'expo_push_token'
--   ) as kolom_bestaat,
--   has_column_privilege('authenticated', 'public.profiles', 'expo_push_token', 'UPDATE') as authenticated_kan_wijzigen;
-- -- verwacht: als kolom_bestaat = true, dan ook authenticated_kan_wijzigen = true.
-- -- als kolom_bestaat = false, is authenticated_kan_wijzigen irrelevant (niets om te wijzigen).
-- ─────────────────────────────────────────────────────────────────────────

begin;

do $$
begin
  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'profiles' and column_name = 'expo_push_token'
  ) then
    execute 'grant update (expo_push_token) on public.profiles to authenticated';
  end if;
end $$;

do $$
declare
  v_column_exists boolean;
begin
  select exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'profiles' and column_name = 'expo_push_token'
  ) into v_column_exists;

  if v_column_exists and not has_column_privilege('authenticated', 'public.profiles', 'expo_push_token', 'UPDATE') then
    raise exception 'public.profiles.expo_push_token bestaat maar authenticated kan hem niet wijzigen - de grant is niet correct toegepast.';
  end if;

  if v_column_exists then
    raise notice 'public.profiles.expo_push_token bestaat en authenticated heeft UPDATE-recht.';
  else
    raise notice 'public.profiles.expo_push_token bestaat niet op deze database - niets te doen.';
  end if;
end $$;

commit;
