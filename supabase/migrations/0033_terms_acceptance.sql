-- Vastleggen van toestemming met de algemene voorwaarden en de
-- privacyverklaring bij registratie: nieuwe kolom
-- public.profiles.terms_accepted_at (timestamptz, null voor bestaande
-- accounts - zij hebben nooit het nieuwe vinkje gezien).
--
-- Gevuld door handle_new_user() (0001_init.sql) zelf, niet door de client
-- achteraf: RegisterDetailsScreen.tsx vereist het vinkje voordat
-- signUpWithEmail() overhaupt aangeroepen wordt, en geeft
-- `options: { data: { terms_accepted: true } }` mee aan
-- supabase.auth.signUp() - dat landt in auth.users.raw_user_meta_data,
-- waar de AFTER INSERT-trigger op auth.users (die al bestond, vult ook
-- de bijbehorende subscriptions-rij) het leest en `now()` wegschrijft.
-- Dit werkt ook wanneer e-mailbevestiging vereist is (geen sessie
-- beschikbaar op het moment van de latere profiles-upsert in
-- RegisterDetailsScreen.tsx) - auth.users zelf ontstaat namelijk altijd
-- al bij signUp(), bevestigd of niet.
--
-- "Voorkom dat de gebruiker deze waarde achteraf zelf kan wijzigen": RLS
-- alleen kan dit niet (de bestaande "Users can update their own profile"-
-- policy is per-rij, niet per-kolom) - dit gebruikt daarom kolomrechten,
-- exact hetzelfde patroon als 0014_discover_profiles_location_privacy.sql
-- al toepaste voor latitude/longitude (alleen daar voor SELECT, hier voor
-- UPDATE): de blanket table-level UPDATE-grant wordt ingetrokken en
-- vervangen door een expliciete kolomlijst die precies de kolommen bevat
-- die de app vandaag al via de client bijwerkt (EditProfileScreen,
-- LocationSetupScreen, RegisterDetailsScreen, Instellingen,
-- lib/notifications.ts) - terms_accepted_at staat daar bewust niet bij.
--
-- Run dit via `supabase db push` of plak het in de Supabase SQL editor.
-- Veilig om vaker te draaien (`add column if not exists`, `create or
-- replace function`, revoke/grant zijn idempotent).
--
-- ─────────────────────────────────────────────────────────────────────────
-- Controlequery (plak dit los in de SQL editor om te verifiëren):
-- ─────────────────────────────────────────────────────────────────────────
-- select
--   (select data_type from information_schema.columns
--      where table_schema = 'public' and table_name = 'profiles' and column_name = 'terms_accepted_at') as column_type,
--   has_column_privilege('authenticated', 'public.profiles', 'terms_accepted_at', 'UPDATE') as authenticated_kan_wijzigen,
--   has_column_privilege('authenticated', 'public.profiles', 'terms_accepted_at', 'SELECT') as authenticated_kan_lezen,
--   (select count(*) from public.profiles where terms_accepted_at is not null) as accounts_met_toestemming,
--   (select count(*) from public.profiles where terms_accepted_at is null) as accounts_zonder_toestemming;
-- -- verwacht: column_type = 'timestamp with time zone', authenticated_kan_wijzigen = false,
-- -- authenticated_kan_lezen = true. De twee laatste tellingen zijn
-- -- informatief: "accounts_zonder_toestemming" zijn bestaande accounts van
-- -- vóór deze migratie (en iedereen die ooit zonder sessie bleef steken
-- -- vóór e-mailbevestiging en nooit terugkwam) - geen foutstaat op zich.
-- ─────────────────────────────────────────────────────────────────────────

-- ─────────────────────────────────────────────────────────────────────────
-- 1. Nieuwe kolom
-- ─────────────────────────────────────────────────────────────────────────
alter table public.profiles add column if not exists terms_accepted_at timestamptz;

-- ─────────────────────────────────────────────────────────────────────────
-- 2. handle_new_user(): vult terms_accepted_at vanuit signup-metadata
-- ─────────────────────────────────────────────────────────────────────────
create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id, terms_accepted_at) values (
    new.id,
    case
      when (new.raw_user_meta_data ->> 'terms_accepted')::boolean is true then now()
      else null
    end
  )
  on conflict (id) do nothing;
  insert into public.subscriptions (user_id, plan) values (new.id, 'basis')
  on conflict (user_id) do nothing;
  return new;
end;
$$ language plpgsql security definer;

-- ─────────────────────────────────────────────────────────────────────────
-- 3. Kolomrechten: terms_accepted_at is leesbaar maar niet door de client
--    zelf te wijzigen. Alle andere kolommen blijven precies zo bijwerkbaar
--    als vóór deze migratie (zie de uitleg hierboven voor de exacte lijst).
-- ─────────────────────────────────────────────────────────────────────────
revoke update on public.profiles from authenticated;
grant update (
  id, full_name, birthdate, gender, bio, sport, level, city,
  latitude, longitude, search_radius_km, avatar_url, photo_url,
  is_onboarded, push_notifications_enabled, profile_visible,
  availability_days, expo_push_token, created_at, updated_at
) on public.profiles to authenticated;

-- Additief op de bestaande kolom-SELECT-grant uit
-- 0014_discover_profiles_location_privacy.sql - geen reden om
-- terms_accepted_at te verbergen voor de eigenaar zelf (nodig voor "Mijn
-- gegevens opvragen"), en net als de meeste andere profielkolommen
-- (birthdate, gender, bio, ...) is dit geen gegeven dat specifiek van een
-- ándere gebruiker afgeschermd moet worden zoals latitude/longitude.
grant select (terms_accepted_at) on public.profiles to authenticated;

-- ─────────────────────────────────────────────────────────────────────────
-- Zelfcontrole
-- ─────────────────────────────────────────────────────────────────────────
do $$
begin
  if not exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'profiles' and column_name = 'terms_accepted_at'
      and data_type = 'timestamp with time zone'
  ) then
    raise exception 'public.profiles.terms_accepted_at ontbreekt of heeft niet het type timestamptz.';
  end if;

  if has_column_privilege('authenticated', 'public.profiles', 'terms_accepted_at', 'UPDATE') then
    raise exception 'authenticated kan terms_accepted_at nog zelf wijzigen - de kolomrechten zijn niet correct ingetrokken.';
  end if;

  if not has_column_privilege('authenticated', 'public.profiles', 'terms_accepted_at', 'SELECT') then
    raise exception 'authenticated kan terms_accepted_at niet lezen - nodig voor "Mijn gegevens opvragen".';
  end if;

  -- Geen collateral damage: andere, al langer bestaande kolommen die de
  -- app daadwerkelijk client-side bijwerkt moeten bijwerkbaar blijven.
  if not has_column_privilege('authenticated', 'public.profiles', 'full_name', 'UPDATE') then
    raise exception 'authenticated kan full_name niet meer bijwerken - te veel ingetrokken bij stap 3.';
  end if;
  if not has_column_privilege('authenticated', 'public.profiles', 'birthdate', 'UPDATE') then
    raise exception 'authenticated kan birthdate niet meer bijwerken - te veel ingetrokken bij stap 3.';
  end if;
  if not has_column_privilege('authenticated', 'public.profiles', 'latitude', 'UPDATE') then
    raise exception 'authenticated kan latitude niet meer bijwerken - te veel ingetrokken bij stap 3.';
  end if;
  if not has_column_privilege('authenticated', 'public.profiles', 'push_notifications_enabled', 'UPDATE') then
    raise exception 'authenticated kan push_notifications_enabled niet meer bijwerken - te veel ingetrokken bij stap 3.';
  end if;
  if not has_column_privilege('authenticated', 'public.profiles', 'expo_push_token', 'UPDATE') then
    raise exception 'authenticated kan expo_push_token niet meer bijwerken - te veel ingetrokken bij stap 3.';
  end if;

  raise notice 'profiles.terms_accepted_at: kolom aanwezig (timestamptz), leesbaar maar niet zelf te wijzigen door authenticated; overige profielkolommen blijven ongewijzigd bijwerkbaar.';
end $$;
