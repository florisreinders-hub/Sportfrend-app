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
-- die op dít moment daadwerkelijk in public.profiles bestaan, minus
-- terms_accepted_at zelf.
--
-- BELANGRIJK - eerdere versie van dit bestand faalde in productie: die
-- kolomlijst bevatte ook `expo_push_token`, in de veronderstelling dat
-- 0011_push_notifications.sql die kolom al had toegevoegd. Op de live
-- database is dat niet het geval (zie README.md §"Pushmeldingen" voor
-- waarom: 0011 gebruikt `supabase_functions.http_request`, een functie
-- die op dit project niet bestaat, en de kolom-toevoeging zat in
-- hetzelfde script - zonder expliciete transactiegrenzen rolde een
-- client die het geheel als één losse batch verstuurt dat mogelijk samen
-- terug, of het bestand is om die reden nooit (volledig) uitgevoerd).
-- `grant update (..., expo_push_token, ...)` op een kolom die niet
-- bestaat geeft een harde fout ("column ... does not exist"), dus deze
-- kolomlijst mag nooit méér noemen dan wat er daadwerkelijk staat. De
-- zelfcontrole onderaan dit bestand controleert dat nu in beide
-- richtingen (zie daar), zodat dit soort mismatch nooit meer stil tot
-- een foutmelding pas bij het uitvoeren leidt, maar al bij de
-- zelfcontrole een duidelijke naam-en-richting krijgt.
--
-- Run dit via `supabase db push` of plak het in de Supabase SQL editor.
-- Veilig om vaker te draaien (`add column if not exists`, `create or
-- replace function`, revoke/grant zijn idempotent). De hele inhoud
-- (kolom toevoegen, functie vervangen, kolomrechten, zelfcontrole) draait
-- in één expliciete transactie (BEGIN/COMMIT hieronder) - een fout waar
-- dan ook in dit bestand (inclusief de zelfcontrole die met opzet
-- `raise exception` gebruikt, niet alleen `raise notice`) rolt het
-- geheel terug. Dit is bewust expliciet, niet een aanname over hoe de
-- aanroepende tool (`supabase db push`, de SQL editor, een losse `psql
-- -f`) transacties afhandelt - sommige daarvan committen elke top-level
-- statement apart zodra er geen omliggende BEGIN/COMMIT is, wat precies
-- het mechanisme kan zijn waardoor de vorige poging een deel van zijn
-- effect behield terwijl een later statement alsnog faalde.
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

begin;

-- ─────────────────────────────────────────────────────────────────────────
-- 1. Nieuwe kolom
-- ─────────────────────────────────────────────────────────────────────────
alter table public.profiles add column if not exists terms_accepted_at timestamptz;

-- ─────────────────────────────────────────────────────────────────────────
-- 2. handle_new_user(): vult terms_accepted_at vanuit signup-metadata
--
-- search_path = public toegevoegd (was oorspronkelijk niet ingesteld,
-- vanaf 0001_init.sql al zo - de enige SECURITY DEFINER-functie in de
-- hele repo waar dat voor gold, zie 0035_security_definer_search_path.sql).
-- Staat hier ook, niet alleen in 0035's eigen ALTER FUNCTION, zodat een
-- latere her-uitvoering van dit bestand (migraties zijn bewust veilig
-- om vaker te draaien) de fix uit 0035 niet weer ongedaan maakt.
-- ─────────────────────────────────────────────────────────────────────────
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
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
$$;

-- ─────────────────────────────────────────────────────────────────────────
-- 3. Kolomrechten: terms_accepted_at is leesbaar maar niet door de client
--    zelf te wijzigen. Alle andere kolommen die daadwerkelijk bestaan
--    blijven precies zo bijwerkbaar als vóór deze migratie.
--
--    expo_push_token staat hier BEWUST niet bij - die kolom bestaat niet
--    op elke database (zie de uitleg hierboven). Zodra
--    0011_push_notifications.sql (of een vervangende migratie) die kolom
--    daadwerkelijk toevoegt, moet die migratie zelf ook een
--    `grant update (expo_push_token) on public.profiles to authenticated;`
--    bevatten - een kolom die na deze `revoke update on public.profiles`
--    ontstaat, krijgt anders geen enkel UPDATE-recht, voor niemand
--    behalve `service_role`/`postgres`.
-- ─────────────────────────────────────────────────────────────────────────
revoke update on public.profiles from authenticated;
grant update (
  id, full_name, birthdate, gender, bio, sport, level, city,
  latitude, longitude, search_radius_km, avatar_url, photo_url,
  is_onboarded, push_notifications_enabled, profile_visible,
  availability_days, created_at, updated_at
) on public.profiles to authenticated;

-- Additief op de bestaande kolom-SELECT-grant uit
-- 0014_discover_profiles_location_privacy.sql - geen reden om
-- terms_accepted_at te verbergen voor de eigenaar zelf (nodig voor "Mijn
-- gegevens opvragen"), en net als de meeste andere profielkolommen
-- (birthdate, gender, bio, ...) is dit geen gegeven dat specifiek van een
-- ándere gebruiker afgeschermd moet worden zoals latitude/longitude.
grant select (terms_accepted_at) on public.profiles to authenticated;

-- ─────────────────────────────────────────────────────────────────────────
-- Zelfcontrole - in twee richtingen, zodat een mismatch tussen de
-- kolomlijst hierboven en de daadwerkelijke tabel hier wordt opgevangen
-- in plaats van pas als een harde `grant`-fout (de oorzaak van de vorige
-- productiestoring) of, nog stiller, als een kolom die na deze migratie
-- stilletjes write-locked blijft voor altijd niemand opmerkt:
--   a) elke kolom in de grantlijst hierboven bestaat ook echt in de tabel
--      (vangt precies de fout met expo_push_token op, vóórdat die ooit
--      weer terugkomt - bv. als iemand een kolom hernoemt/verwijdert
--      zonder deze lijst bij te werken);
--   b) elke kolom die in de tabel staat (behalve terms_accepted_at, die
--      met opzet alleen leesbaar is) staat ook in de grantlijst (vangt
--      het omgekeerde: een kolom die ooit aan de tabel wordt toegevoegd
--      zonder de grantlijst bij te werken, en daardoor onopgemerkt
--      write-locked blijft voor de client).
-- ─────────────────────────────────────────────────────────────────────────
do $$
declare
  v_grant_columns text[] := array[
    'id', 'full_name', 'birthdate', 'gender', 'bio', 'sport', 'level', 'city',
    'latitude', 'longitude', 'search_radius_km', 'avatar_url', 'photo_url',
    'is_onboarded', 'push_notifications_enabled', 'profile_visible',
    'availability_days', 'created_at', 'updated_at'
  ];
  v_table_columns text[];
  v_missing_from_table text[];
  v_missing_from_grant text[];
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

  select array_agg(column_name::text) into v_table_columns
  from information_schema.columns
  where table_schema = 'public' and table_name = 'profiles';

  -- Richting a: de grantlijst mag geen kolom noemen die niet bestaat.
  select array_agg(col) into v_missing_from_table
  from unnest(v_grant_columns) as col
  where col <> all (v_table_columns);

  if v_missing_from_table is not null then
    raise exception 'De UPDATE-grantlijst in dit bestand noemt kolommen die niet bestaan in public.profiles: % - pas de grantlijst aan op het daadwerkelijke schema.', v_missing_from_table;
  end if;

  -- Richting b: elke bestaande kolom (behalve terms_accepted_at) moet in
  -- de grantlijst staan, anders is hij na de revoke hierboven stilletjes
  -- write-locked voor authenticated.
  select array_agg(col) into v_missing_from_grant
  from unnest(v_table_columns) as col
  where col <> 'terms_accepted_at'
    and col <> all (v_grant_columns);

  if v_missing_from_grant is not null then
    raise exception 'Deze kolommen van public.profiles ontbreken in de UPDATE-grantlijst en zijn dus write-locked voor authenticated: % - voeg ze toe aan de grantlijst (of, als dat met opzet is, aan de uitzonderingslijst hier).', v_missing_from_grant;
  end if;

  raise notice 'profiles.terms_accepted_at: kolom aanwezig (timestamptz), leesbaar maar niet zelf te wijzigen door authenticated; de UPDATE-grantlijst komt in beide richtingen overeen met het daadwerkelijke schema (% kolommen, exact terms_accepted_at uitgezonderd).', array_length(v_table_columns, 1);
end $$;

commit;
