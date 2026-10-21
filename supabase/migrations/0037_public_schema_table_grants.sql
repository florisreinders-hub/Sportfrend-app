-- Supabase stopt per 30 oktober 2026 met het automatisch toekennen van
-- Data-API-toegang (de impliciete `alter default privileges ... grant
-- select, insert, update, delete on tables to anon, authenticated,
-- service_role` die een Supabase-project tot nu toe voor elke NIEUWE
-- tabel in `public` toepast). Na die datum heeft een tabel die zonder
-- expliciete `grant`-statements wordt aangemaakt - zoals letterlijk elke
-- tabel in dit project tot nu toe, behalve de kolom-niveau grants op
-- `profiles` (0014/0033) - helemaal GEEN rechten voor `anon`/
-- `authenticated`/`service_role`, nog vóór RLS ook maar wordt
-- geëvalueerd (GRANT en RLS zijn twee onafhankelijke lagen: zonder
-- tabel-niveau GRANT krijg je een "permission denied", RLS komt daar
-- niet eens aan te pas, ook niet voor `service_role`, die wél
-- `bypassrls` heeft maar dat slaat alleen op rijfiltering, niet op de
-- basis tabelrechten).
--
-- Bestaande, al gedraaide tabellen op een live project behouden de
-- rechten die ze al hadden (GRANT-toekenning is niet retroactief) - het
-- echte risico is (a) een verse installatie/`supabase db reset` na die
-- datum, en (b) elke toekomstige migratie die een nieuwe tabel aanmaakt
-- zonder zelf expliciete grants toe te voegen. Deze migratie dekt (a)
-- voor alle bestaande tabellen; zie README.md §"Database schema" voor de
-- nieuwe regel die (b) moet voorkomen.
--
-- Scope: uitsluitend het `public`-schema (zo is Supabase's eigen
-- aankondiging ook geformuleerd) - niet `storage.objects`/
-- `storage.buckets`, die al hun eigen, al expliciete policies hebben
-- (0001/0009/0018) en in een door Supabase beheerd schema staan, niet
-- `public`.
--
-- Per rol:
--   anon           - geen enkele RLS-policy op geen enkele tabel in dit
--                    hele project noemt `anon` of ongequalificeerd
--                    `public` (op één na: twee storage-policies, buiten
--                    scope hierboven) - deze app vereist overal inloggen.
--                    Expliciet `revoke all` in plaats van simpelweg
--                    niets te doen, zodat een eventueel nog aanwezige
--                    oude automatische grant ook wordt opgeruimd.
--   authenticated  - exact de verbs die de bestaande RLS-policies
--                    toestaan ÉN die de app daadwerkelijk gebruikt (waar
--                    een policy breder is dan wat de app gebruikt, zoals
--                    `swipes`'  "for all" terwijl de app nooit een swipe
--                    verwijdert, wordt hier niet breder gegrant dan
--                    nodig - "alleen de rechten die nodig zijn").
--   service_role   - alle vier de verbs op elke tabel: dit is de
--                    vertrouwde backend-rol (Edge Functions, RLS-bypass
--                    by design), dezelfde volledige-toegang-conventie
--                    die Supabase hier zelf al voor hanteert.
--
-- `profiles` is hier een uitzondering: SELECT en UPDATE zijn al expliciet
-- kolom-niveau gegrant (0014_discover_profiles_location_privacy.sql resp.
-- 0033_terms_acceptance.sql) - niet hier herhaald, om niet twee plekken
-- met dezelfde kolomlijst te laten kunnen uit elkaar lopen. Alleen de tot
-- nu toe ontbrekende INSERT-grant (nodig voor de profiel-insert in
-- RegisterDetailsScreen.tsx/LocationSetupScreen.tsx) wordt hier
-- toegevoegd.
--
-- Geen enkele kolom-, tabel- of functienaam hieronder is vanuit de repo
-- gegokt - elke tabel is nagelopen op (1) elke `create policy` die erop
-- staat (welke verbs RLS toestaat) en (2) elke `.from("<tabel>")`-aanroep
-- in de hele app (`lib/api.ts` e.a., welke verbs daadwerkelijk gebruikt
-- worden) voordat de grant-lijst hieronder is vastgesteld.
--
-- Run dit via `supabase db push` of plak het in de Supabase SQL editor.
-- Veilig om vaker te draaien (`grant`/`revoke` zijn idempotent).
--
-- ─────────────────────────────────────────────────────────────────────────
-- Controlequery (los te draaien, geeft per tabel/rol een compacte samenvatting):
-- ─────────────────────────────────────────────────────────────────────────
-- select
--   c.relname as table_name,
--   has_table_privilege('anon', 'public.' || c.relname, 'SELECT') as anon_select,
--   has_table_privilege('authenticated', 'public.' || c.relname, 'SELECT') as auth_select,
--   has_table_privilege('authenticated', 'public.' || c.relname, 'INSERT') as auth_insert,
--   has_table_privilege('authenticated', 'public.' || c.relname, 'UPDATE') as auth_update,
--   has_table_privilege('authenticated', 'public.' || c.relname, 'DELETE') as auth_delete,
--   has_table_privilege('service_role', 'public.' || c.relname, 'SELECT')
--     and has_table_privilege('service_role', 'public.' || c.relname, 'INSERT')
--     and has_table_privilege('service_role', 'public.' || c.relname, 'UPDATE')
--     and has_table_privilege('service_role', 'public.' || c.relname, 'DELETE') as service_role_all
-- from pg_class c
-- join pg_namespace n on n.oid = c.relnamespace
-- where n.nspname = 'public' and c.relkind = 'r'
-- order by c.relname;
-- ─────────────────────────────────────────────────────────────────────────

begin;

grant usage on schema public to anon, authenticated, service_role;

-- ─────────────────────────────────────────────────────────────────────────
-- profiles - alleen de ontbrekende INSERT-grant; SELECT/UPDATE staan al
-- kolom-niveau gegrant in 0014/0033 (zie uitleg hierboven).
-- ─────────────────────────────────────────────────────────────────────────
revoke all on public.profiles from anon;
grant insert on public.profiles to authenticated;
grant all on public.profiles to service_role;

-- ─────────────────────────────────────────────────────────────────────────
-- swipes - RLS: "Users manage their own swipes" (for all), "Users can see
-- likes directed at them" (select). App gebruikt alleen select/upsert
-- (recordSwipe(), lib/api.ts) - geen delete, dus niet breder gegrant dan
-- dat ondanks de "for all"-policy.
-- ─────────────────────────────────────────────────────────────────────────
revoke all on public.swipes from anon;
grant select, insert, update on public.swipes to authenticated;
grant all on public.swipes to service_role;

-- ─────────────────────────────────────────────────────────────────────────
-- discover_daily_views - RLS: alleen select voor de client. De enige
-- INSERT gebeurt binnen discover_profiles() (security definer, draait
-- met de rechten van de functie-eigenaar, niet die van de aanroeper) -
-- authenticated zelf heeft dus geen insert/update/delete nodig.
-- ─────────────────────────────────────────────────────────────────────────
revoke all on public.discover_daily_views from anon;
grant select on public.discover_daily_views to authenticated;
grant all on public.discover_daily_views to service_role;

-- ─────────────────────────────────────────────────────────────────────────
-- matches - RLS: select/insert/delete (recordSwipe() upsert, deleteMatch()
-- "Vriend verwijderen") - geen update-policy, geen update-aanroep in de app.
-- ─────────────────────────────────────────────────────────────────────────
revoke all on public.matches from anon;
grant select, insert, delete on public.matches to authenticated;
grant all on public.matches to service_role;

-- ─────────────────────────────────────────────────────────────────────────
-- messages - RLS: select/insert alleen (sendMessage(), fetchMessages()) -
-- geen update (ook niet voor read_at, die kolom wordt nergens vanuit de
-- client gezet) of delete.
-- ─────────────────────────────────────────────────────────────────────────
revoke all on public.messages from anon;
grant select, insert on public.messages to authenticated;
grant all on public.messages to service_role;

-- ─────────────────────────────────────────────────────────────────────────
-- posts - RLS: select/insert/delete (createPost(), deletePost()) - geen
-- update-aanroep in de app, geen update-policy.
-- ─────────────────────────────────────────────────────────────────────────
revoke all on public.posts from anon;
grant select, insert, delete on public.posts to authenticated;
grant all on public.posts to service_role;

-- ─────────────────────────────────────────────────────────────────────────
-- post_likes - RLS: select + "for all" - app gebruikt select/insert/delete
-- (toggleLike(), lib/api.ts), geen update.
-- ─────────────────────────────────────────────────────────────────────────
revoke all on public.post_likes from anon;
grant select, insert, delete on public.post_likes to authenticated;
grant all on public.post_likes to service_role;

-- ─────────────────────────────────────────────────────────────────────────
-- subscriptions - RLS sinds 0031_subscriptions_webhook_only.sql: alleen
-- nog een select-policy voor de client (de insert/update-policy van vóór
-- die migratie is toen al gedropt) - plan/status worden uitsluitend nog
-- server-side gezet, via revenuecat-webhook met de service-role-client.
-- ─────────────────────────────────────────────────────────────────────────
revoke all on public.subscriptions from anon;
grant select on public.subscriptions to authenticated;
grant all on public.subscriptions to service_role;

-- ─────────────────────────────────────────────────────────────────────────
-- reports - RLS: eigen rapportages aanmaken/lezen (insert/select) plus
-- moderator-select/update (resolveReport()) - geen delete-policy, geen
-- delete-aanroep.
-- ─────────────────────────────────────────────────────────────────────────
revoke all on public.reports from anon;
grant select, insert, update on public.reports to authenticated;
grant all on public.reports to service_role;

-- ─────────────────────────────────────────────────────────────────────────
-- blocks - RLS: insert/select/delete - geen update-policy (blockUser()'s
-- upsert raakt in de praktijk nooit het update-pad omdat (blocker_id,
-- blocked_id) de unieke sleutel zelf is).
-- ─────────────────────────────────────────────────────────────────────────
revoke all on public.blocks from anon;
grant select, insert, delete on public.blocks to authenticated;
grant all on public.blocks to service_role;

-- ─────────────────────────────────────────────────────────────────────────
-- support_requests - RLS: alleen insert/select voor de client.
-- ─────────────────────────────────────────────────────────────────────────
revoke all on public.support_requests from anon;
grant select, insert on public.support_requests to authenticated;
grant all on public.support_requests to service_role;

-- ─────────────────────────────────────────────────────────────────────────
-- trainings - RLS: select/insert/update (createTraining(),
-- updateTrainingProposal(), respondToTraining()) - geen delete-policy,
-- geen delete-aanroep.
-- ─────────────────────────────────────────────────────────────────────────
revoke all on public.trainings from anon;
grant select, insert, update on public.trainings to authenticated;
grant all on public.trainings to service_role;

-- ─────────────────────────────────────────────────────────────────────────
-- content_filter_words - geen enkele client-aanroep (alleen gelezen
-- binnen find_flagged_words(), security definer) en geen RLS-policy voor
-- `authenticated` - deze rol heeft hier dus helemaal niets nodig.
-- ─────────────────────────────────────────────────────────────────────────
revoke all on public.content_filter_words from anon, authenticated;
grant all on public.content_filter_words to service_role;

-- ─────────────────────────────────────────────────────────────────────────
-- flagged_content - RLS: alleen een moderator-only select-policy - de
-- GRANT staat hier los van de is_moderator()-check, die blijft RLS's taak.
-- ─────────────────────────────────────────────────────────────────────────
revoke all on public.flagged_content from anon;
grant select on public.flagged_content to authenticated;
grant all on public.flagged_content to service_role;

-- ─────────────────────────────────────────────────────────────────────────
-- notifications - RLS: select/update (markNotificationRead()) - insert
-- gebeurt uitsluitend binnen de drie security-definer triggerfuncties.
-- ─────────────────────────────────────────────────────────────────────────
revoke all on public.notifications from anon;
grant select, update on public.notifications to authenticated;
grant all on public.notifications to service_role;

-- ─────────────────────────────────────────────────────────────────────────
-- Zelfcontrole - voor elke tabel: anon heeft niets, authenticated heeft
-- precies de verwachte verbs (niet meer, niet minder), service_role heeft
-- alles. Faalt met een specifieke naam zodra iets afwijkt, in plaats van
-- een kale "Success".
-- ─────────────────────────────────────────────────────────────────────────
do $$
declare
  v_table text;
  v_expected text[];
  v_verb text;
  v_tables_and_verbs text[][] := array[
    array['profiles', 'select,insert,update'],
    array['swipes', 'select,insert,update'],
    array['discover_daily_views', 'select'],
    array['matches', 'select,insert,delete'],
    array['messages', 'select,insert'],
    array['posts', 'select,insert,delete'],
    array['post_likes', 'select,insert,delete'],
    array['subscriptions', 'select'],
    array['reports', 'select,insert,update'],
    array['blocks', 'select,insert,delete'],
    array['support_requests', 'select,insert'],
    array['trainings', 'select,insert,update'],
    array['content_filter_words', ''],
    array['flagged_content', 'select'],
    array['notifications', 'select,update']
  ];
  v_row text[];
  v_all_verbs text[] := array['select', 'insert', 'update', 'delete'];
  v_anon_has boolean;
  v_auth_has boolean;
  v_service_has boolean;
begin
  foreach v_row slice 1 in array v_tables_and_verbs loop
    v_table := v_row[1];
    v_expected := case when v_row[2] = '' then array[]::text[] else string_to_array(v_row[2], ',') end;

    if not exists (select 1 from pg_class c join pg_namespace n on n.oid = c.relnamespace where n.nspname = 'public' and c.relname = v_table) then
      raise exception 'Tabel public.% bestaat niet (meer) - deze zelfcontrole noemt alleen tabellen die bij het schrijven van deze migratie daadwerkelijk bestonden.', v_table;
    end if;

    foreach v_verb in array v_all_verbs loop
      -- DELETE kan niet kolom-niveau gegrant worden (has_any_column_privilege
      -- accepteert dat privilegetype niet eens) - has_table_privilege is
      -- daarvoor altijd correct. Voor select/insert/update gebruikt deze
      -- zelfcontrole has_any_column_privilege, niet has_table_privilege:
      -- profiles' SELECT en UPDATE zijn bewust alleen kolom-niveau gegrant
      -- (0014/0033/0038), niet table-niveau, en has_table_privilege geeft
      -- dan ten onrechte false terug, ook al kan authenticated wel degelijk
      -- (de toegestane kolommen van) de tabel select/update'en.
      -- has_any_column_privilege is voor tabellen met alleen table-niveau
      -- grants (alle andere tabellen hier) equivalent aan has_table_privilege,
      -- dus deze ene functie dekt beide gevallen correct.
      if v_verb = 'delete' then
        v_anon_has := has_table_privilege('anon', 'public.' || v_table, upper(v_verb));
        v_auth_has := has_table_privilege('authenticated', 'public.' || v_table, upper(v_verb));
        v_service_has := has_table_privilege('service_role', 'public.' || v_table, upper(v_verb));
      else
        v_anon_has := has_any_column_privilege('anon', 'public.' || v_table, upper(v_verb));
        v_auth_has := has_any_column_privilege('authenticated', 'public.' || v_table, upper(v_verb));
        v_service_has := has_any_column_privilege('service_role', 'public.' || v_table, upper(v_verb));
      end if;

      if v_anon_has then
        raise exception 'anon heeft nog % op public.% - zou geen enkel recht moeten hebben.', v_verb, v_table;
      end if;

      if v_verb = any(v_expected) then
        if not v_auth_has then
          raise exception 'authenticated mist % op public.% (verwacht: %).', v_verb, v_table, array_to_string(v_expected, ', ');
        end if;
      else
        if v_auth_has then
          raise exception 'authenticated heeft onverwacht % op public.% (verwacht alleen: %).', v_verb, v_table, array_to_string(v_expected, ', ');
        end if;
      end if;

      if not v_service_has then
        raise exception 'service_role mist % op public.% - deze rol moet overal volledige toegang hebben.', v_verb, v_table;
      end if;
    end loop;
  end loop;

  raise notice 'Alle % tabellen in public hebben expliciete grants: anon niets, authenticated precies de bestaande RLS-scope, service_role alles.', array_length(v_tables_and_verbs, 1);
end $$;

commit;
