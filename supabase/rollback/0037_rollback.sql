-- Terugdraaiscript voor supabase/migrations/0037_public_schema_table_grants.sql
-- en supabase/migrations/0038_profiles_expo_push_token_update_grant.sql.
--
-- Herstelt exact de live stand zoals opgevraagd uit de database (vóór die
-- twee migraties):
--   - Alle 15 tabellen in public: anon, authenticated en service_role
--     hebben alle tabelrechten (DELETE, INSERT, REFERENCES, SELECT,
--     TRIGGER, TRUNCATE, UPDATE) - exact wat `grant all on table`
--     toekent, de oude impliciete Supabase-default-privilege-grant die
--     vóór 30 oktober 2026 voor elke nieuwe tabel in public gold.
--   - Uitzondering profiles: authenticated heeft op tabelniveau alleen
--     DELETE, INSERT, REFERENCES, TRIGGER, TRUNCATE (geen SELECT/UPDATE -
--     dat loopt al sinds 0014_discover_profiles_location_privacy.sql resp.
--     0033_terms_acceptance.sql via kolomrechten, niet via de tabelrechten
--     zelf; 0037/0038 hebben die kolomverdeling niet aangepast, dus dit
--     script herstelt haar hier toch expliciet, zodat het script op
--     zichzelf staat en niet afhankelijk is van wat er in 0014/0033/0038
--     staat). Kolomrechten authenticated op profiles:
--       - latitude, longitude, expo_push_token: alleen UPDATE (geen
--         SELECT) - schrijfbaar, niet leesbaar.
--       - terms_accepted_at: alleen SELECT (geen UPDATE) - leesbaar, niet
--         schrijfbaar.
--       - alle overige kolommen (id, full_name, birthdate, gender, bio,
--         sport, level, city, search_radius_km, avatar_url, photo_url,
--         is_onboarded, push_notifications_enabled, profile_visible,
--         availability_days, created_at, updated_at): zowel SELECT als
--         UPDATE.
--
-- Dit bestand staat bewust buiten supabase/migrations/ - het is geen
-- voorwaartse migratie en wordt niet door `supabase db push`/`db reset`
-- meegenomen. Alleen handmatig te draaien als 0037/0038 echt van de live
-- database terug moeten worden gedraaid, via
-- `psql -f supabase/rollback/0037_rollback.sql` of de Supabase SQL editor.
-- Veilig om vaker te draaien: elke revoke/grant hieronder legt een
-- absolute eindtoestand vast (niet een relatieve wijziging t.o.v. wat er
-- al stond), dus een herhaalde run verandert niets aan het resultaat.
--
-- Schema-niveau `usage on schema public` wordt hier bewust niet
-- aangeraakt: dat was al impliciet aanwezig via de standaard PUBLIC-rol
-- vóór 0037's expliciete grant, en 0037 heeft nooit een `revoke usage`
-- gedaan - er is op schema-niveau dus niets om terug te draaien.
--
-- ─────────────────────────────────────────────────────────────────────────
-- Controlequery (los te draaien na dit script, zelfde vorm als 0037's
-- eigen controlequery):
-- ─────────────────────────────────────────────────────────────────────────
-- select
--   c.relname as table_name,
--   has_table_privilege('anon', 'public.' || c.relname, 'SELECT') as anon_select,
--   has_table_privilege('authenticated', 'public.' || c.relname, 'SELECT') as auth_select,
--   has_table_privilege('service_role', 'public.' || c.relname, 'SELECT') as service_select
-- from pg_class c
-- join pg_namespace n on n.oid = c.relnamespace
-- where n.nspname = 'public' and c.relkind = 'r'
-- order by c.relname;
-- -- verwacht: anon_select/auth_select/service_select allemaal true op elke
-- -- tabel, behalve profiles waar auth_select false moet zijn (kolomrechten
-- -- dekken dat daar in plaats van tabelrechten - zie
-- -- has_column_privilege('authenticated', 'public.profiles', '<kolom>', 'SELECT')
-- -- voor de kolom-niveau controle).
-- ─────────────────────────────────────────────────────────────────────────

begin;

-- 14 tabellen (alles behalve profiles): volledige tabelrechten terug voor
-- alle drie de rollen, exact de oude impliciete default-grant.
revoke all on
  public.swipes, public.discover_daily_views, public.matches,
  public.messages, public.posts, public.post_likes, public.subscriptions,
  public.reports, public.blocks, public.support_requests, public.trainings,
  public.content_filter_words, public.flagged_content, public.notifications
  from anon, authenticated, service_role;

grant all on
  public.swipes, public.discover_daily_views, public.matches,
  public.messages, public.posts, public.post_likes, public.subscriptions,
  public.reports, public.blocks, public.support_requests, public.trainings,
  public.content_filter_words, public.flagged_content, public.notifications
  to anon, authenticated, service_role;

-- profiles: eerst alles intrekken (tabel- én kolomniveau, voor alle drie
-- de rollen), dan de exacte live verdeling hieronder opnieuw opbouwen.
revoke all on public.profiles from anon, authenticated, service_role;

grant all on public.profiles to anon, service_role;

-- profiles + authenticated: tabelniveau zonder select/update (dat loopt
-- uitsluitend via de kolomrechten hieronder).
grant delete, insert, references, trigger, truncate on public.profiles to authenticated;

grant select (
  id, full_name, birthdate, gender, bio, sport, level, city,
  search_radius_km, avatar_url, photo_url, is_onboarded,
  push_notifications_enabled, profile_visible, availability_days,
  created_at, updated_at, terms_accepted_at
) on public.profiles to authenticated;

grant update (
  id, full_name, birthdate, gender, bio, sport, level, city,
  search_radius_km, avatar_url, photo_url, is_onboarded,
  push_notifications_enabled, profile_visible, availability_days,
  created_at, updated_at, latitude, longitude, expo_push_token
) on public.profiles to authenticated;

-- ─────────────────────────────────────────────────────────────────────────
-- Zelfcontrole - bevestigt de live stand hierboven is exact herbouwd.
-- ─────────────────────────────────────────────────────────────────────────
do $$
declare
  v_table text;
  v_tables text[] := array[
    'swipes', 'discover_daily_views', 'matches', 'messages', 'posts',
    'post_likes', 'subscriptions', 'reports', 'blocks', 'support_requests',
    'trainings', 'content_filter_words', 'flagged_content', 'notifications'
  ];
  v_write_only_columns text[] := array['latitude', 'longitude', 'expo_push_token'];
  v_read_only_columns text[] := array['terms_accepted_at'];
  v_read_write_columns text[] := array[
    'id', 'full_name', 'birthdate', 'gender', 'bio', 'sport', 'level', 'city',
    'search_radius_km', 'avatar_url', 'photo_url', 'is_onboarded',
    'push_notifications_enabled', 'profile_visible', 'availability_days',
    'created_at', 'updated_at'
  ];
  v_col text;
  -- has_table_privilege met een komma-gescheiden lijst gebruikt OR-
  -- semantiek (true zodra ÉÉN van de genoemde rechten aanwezig is), geen
  -- AND - dus "alle zeven rechten" moet hier per recht los gecontroleerd
  -- en met AND gecombineerd worden, niet als één comma-lijst.
  v_all_table_verbs text[] := array['SELECT', 'INSERT', 'UPDATE', 'DELETE', 'TRUNCATE', 'REFERENCES', 'TRIGGER'];
  v_profiles_auth_verbs text[] := array['INSERT', 'DELETE', 'TRUNCATE', 'REFERENCES', 'TRIGGER'];
  v_verb text;
begin
  foreach v_table in array v_tables loop
    foreach v_verb in array v_all_table_verbs loop
      if not has_table_privilege('anon', 'public.' || v_table, v_verb) then
        raise exception 'anon mist % op public.% - zou alle rechten moeten hebben (oude default-grant).', v_verb, v_table;
      end if;
      if not has_table_privilege('authenticated', 'public.' || v_table, v_verb) then
        raise exception 'authenticated mist % op public.% - zou alle rechten moeten hebben (oude default-grant).', v_verb, v_table;
      end if;
      if not has_table_privilege('service_role', 'public.' || v_table, v_verb) then
        raise exception 'service_role mist % op public.% - zou alle rechten moeten hebben.', v_verb, v_table;
      end if;
    end loop;
  end loop;

  foreach v_verb in array v_all_table_verbs loop
    if not has_table_privilege('anon', 'public.profiles', v_verb) then
      raise exception 'anon mist % op public.profiles - zou alle rechten moeten hebben.', v_verb;
    end if;
    if not has_table_privilege('service_role', 'public.profiles', v_verb) then
      raise exception 'service_role mist % op public.profiles - zou alle rechten moeten hebben.', v_verb;
    end if;
  end loop;

  if has_table_privilege('authenticated', 'public.profiles', 'SELECT') then
    raise exception 'authenticated heeft tabelniveau SELECT op public.profiles - zou alleen kolomrechten moeten hebben.';
  end if;
  if has_table_privilege('authenticated', 'public.profiles', 'UPDATE') then
    raise exception 'authenticated heeft tabelniveau UPDATE op public.profiles - zou alleen kolomrechten moeten hebben.';
  end if;
  foreach v_verb in array v_profiles_auth_verbs loop
    if not has_table_privilege('authenticated', 'public.profiles', v_verb) then
      raise exception 'authenticated mist % op public.profiles.', v_verb;
    end if;
  end loop;

  foreach v_col in array v_write_only_columns loop
    if has_column_privilege('authenticated', 'public.profiles', v_col, 'SELECT') then
      raise exception 'authenticated kan % van public.profiles lezen - zou write-only moeten zijn.', v_col;
    end if;
    if not has_column_privilege('authenticated', 'public.profiles', v_col, 'UPDATE') then
      raise exception 'authenticated kan % van public.profiles niet schrijven - zou write-only moeten zijn.', v_col;
    end if;
  end loop;

  foreach v_col in array v_read_only_columns loop
    if not has_column_privilege('authenticated', 'public.profiles', v_col, 'SELECT') then
      raise exception 'authenticated kan % van public.profiles niet lezen - zou read-only moeten zijn.', v_col;
    end if;
    if has_column_privilege('authenticated', 'public.profiles', v_col, 'UPDATE') then
      raise exception 'authenticated kan % van public.profiles schrijven - zou read-only moeten zijn.', v_col;
    end if;
  end loop;

  foreach v_col in array v_read_write_columns loop
    if not has_column_privilege('authenticated', 'public.profiles', v_col, 'SELECT') then
      raise exception 'authenticated kan % van public.profiles niet lezen - zou leesbaar én schrijfbaar moeten zijn.', v_col;
    end if;
    if not has_column_privilege('authenticated', 'public.profiles', v_col, 'UPDATE') then
      raise exception 'authenticated kan % van public.profiles niet schrijven - zou leesbaar én schrijfbaar moeten zijn.', v_col;
    end if;
  end loop;

  raise notice 'Live stand van vóór 0037/0038 is exact herbouwd op alle % tabellen (incl. profiles'' kolomverdeling).', array_length(v_tables, 1) + 1;
end $$;

commit;
