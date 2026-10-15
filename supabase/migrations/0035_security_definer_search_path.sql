-- Vaste search_path voor alle SECURITY DEFINER-functies in public -
-- voorkomt dat zo'n functie door een aangepaste search_path van de
-- aanroepende sessie naar een ander object (gelijknamig, in een schema
-- dat de aanroeper wél mag schrijven) kan worden "omgeleid". Dit is de
-- standaard Postgres/Supabase-aanbeveling voor SECURITY DEFINER.
--
-- GEEN enkele aanname vanuit de repo: per de eigen waarschuwing in dit
-- verzoek (de repo wijkt soms af van de live database, zoals bij
-- expo_push_token) is dit bestand geschreven aan de hand van de
-- daadwerkelijke live resultaten van de volgende inventarisatiequery -
-- niet vanuit de migratiebestanden in de repo:
--
--   select
--     p.oid::regprocedure as signature,
--     p.proname as function_name,
--     pg_get_function_identity_arguments(p.oid) as arguments,
--     p.proconfig as current_config,
--     (select bool_or(cfg like 'search_path=%') from unnest(coalesce(p.proconfig, '{}')) as cfg) as has_search_path_set,
--     pg_get_functiondef(p.oid) as full_definition
--   from pg_proc p
--   join pg_namespace n on n.oid = p.pronamespace
--   where n.nspname = 'public' and p.prosecdef = true
--   order by p.proname, p.oid;
--
-- Live resultaat (18 functies, exact overeenkomend met het aantal
-- `security definer`-functies dat de repo op dit moment definieert -
-- geen weesoverloads, met name geen oudere `discover_profiles(...)`-
-- signatuur uit 0001/0014/0016/0019/0021 bleef achter):
--
--   17 van de 18 hadden al een vaste search_path:
--     - 16x  SET search_path TO 'public'
--     - is_moderator(): SET search_path TO 'public', 'auth'  (leest
--       auth.users - stond hier dus al goed)
--   1 van de 18 had GEEN search_path (proconfig: null):
--     - handle_new_user()  <-- de daadwerkelijke hiaat die deze
--       migratie dicht
--
-- Punt 3 (objecten uit andere schema's): elke functie hierboven die
-- iets uit `auth` leest (auth.uid()/auth.users) doet dat in de
-- broncode zelf altijd al volledig schema-gekwalificeerd
-- ("auth.uid()", "auth.users") - search_path is dus voor die aanroepen
-- op zich niet eens noodzakelijk, alleen een extra laag verdediging.
-- Geen van de 18 functies verwijst naar `extensions`/`cron`/`net` op
-- enige manier (ongekwalificeerd of niet) - uuid_generate_v4() wordt
-- alleen gebruikt in kolom-DEFAULTs, niet in functiebodies. `public`
-- (plus `auth` voor is_moderator() specifiek, puur om zijn al
-- bestaande, correcte scope niet te versmallen) is voor alle 18
-- voldoende; niets hiervan breekt door deze wijziging.
--
-- Gebruikt ALTER FUNCTION, niet create or replace - de inhoud van geen
-- enkele functie verandert, alleen de vaste search_path-configuratie.
-- Draait in één expliciete transactie (zie 0033_terms_acceptance.sql
-- voor waarom: zonder BEGIN/COMMIT kan een latere fout de eerdere,
-- al uitgevoerde ALTER FUNCTION-statements niet per definitie
-- terugdraaien, afhankelijk van hoe de aanroepende tool dit verstuurt).
-- Veilig om vaker te draaien (ALTER FUNCTION ... SET is idempotent).
--
-- ─────────────────────────────────────────────────────────────────────────
-- Controlequery (plak dit los in de SQL editor om te verifiëren):
-- ─────────────────────────────────────────────────────────────────────────
-- select
--   p.oid::regprocedure as signature,
--   p.proconfig as current_config
-- from pg_proc p
-- join pg_namespace n on n.oid = p.pronamespace
-- where n.nspname = 'public' and p.prosecdef = true
-- order by p.proname, p.oid;
-- -- verwacht: alle 18 rijen hebben nu een niet-lege current_config met
-- -- een 'search_path=...'-element; is_moderator() specifiek met
-- -- 'search_path=public, auth', de overige 17 met 'search_path=public'.
-- ─────────────────────────────────────────────────────────────────────────

begin;

alter function public.can_send_message_today() set search_path = public;
alter function public.can_submit_report_today() set search_path = public;
alter function public.can_submit_support_request_today() set search_path = public;
alter function public.discover_daily_status() set search_path = public;
alter function public.discover_profiles(text, text, integer, double precision, integer, text[]) set search_path = public;
alter function public.find_flagged_words(text) set search_path = public;
alter function public.flag_content_if_needed() set search_path = public;
alter function public.get_my_location() set search_path = public;
-- De daadwerkelijke fix - deze had nog helemaal geen search_path.
alter function public.handle_new_user() set search_path = public;
alter function public.has_elite_access() set search_path = public;
alter function public.has_posts_access() set search_path = public;
-- 'auth' erbij, niet alleen 'public': leest auth.users (via auth.uid()/
-- auth.users, beide al schema-gekwalificeerd) - had dit al vóór deze
-- migratie, hier bewust behouden in plaats van versmald naar 'public'.
alter function public.is_moderator() set search_path = public, auth;
alter function public.messages_daily_status() set search_path = public;
alter function public.notify_on_new_match() set search_path = public;
alter function public.notify_on_new_message() set search_path = public;
alter function public.notify_on_report_resolved() set search_path = public;
alter function public.reports_daily_status() set search_path = public;
alter function public.support_requests_daily_status() set search_path = public;

-- ─────────────────────────────────────────────────────────────────────────
-- Zelfcontrole - noemt uitsluitend de 18 functies die bij het schrijven
-- van deze migratie daadwerkelijk op de live database bleken te staan
-- (zie de inventarisatiequery hierboven), niet een lijst die vanuit de
-- repo is gegokt. Faalt met een duidelijke naam als een functie niet
-- (meer) bestaat, of als search_path na de ALTER FUNCTION-statements
-- hierboven nog steeds ontbreekt.
-- ─────────────────────────────────────────────────────────────────────────
do $$
declare
  v_signatures text[] := array[
    'public.can_send_message_today()',
    'public.can_submit_report_today()',
    'public.can_submit_support_request_today()',
    'public.discover_daily_status()',
    'public.discover_profiles(text,text,integer,double precision,integer,text[])',
    'public.find_flagged_words(text)',
    'public.flag_content_if_needed()',
    'public.get_my_location()',
    'public.handle_new_user()',
    'public.has_elite_access()',
    'public.has_posts_access()',
    'public.is_moderator()',
    'public.messages_daily_status()',
    'public.notify_on_new_match()',
    'public.notify_on_new_message()',
    'public.notify_on_report_resolved()',
    'public.reports_daily_status()',
    'public.support_requests_daily_status()'
  ];
  v_sig text;
  v_oid oid;
  v_config text[];
begin
  foreach v_sig in array v_signatures loop
    v_oid := to_regprocedure(v_sig);
    if v_oid is null then
      raise exception 'Functie % bestaat niet (meer) op deze database - deze zelfcontrole noemt alleen functies die bij het schrijven van 0035 daadwerkelijk live stonden; is het schema sindsdien veranderd?', v_sig;
    end if;

    select proconfig into v_config from pg_proc where oid = v_oid;
    if not exists (select 1 from unnest(coalesce(v_config, '{}')) as cfg where cfg like 'search_path=%') then
      raise exception 'Functie % heeft nog geen search_path ingesteld na deze migratie.', v_sig;
    end if;
  end loop;

  -- is_moderator() moet specifiek 'auth' in zijn search_path behouden
  -- (zie uitleg hierboven) - bevestigt dat dit niet per ongeluk versmald
  -- is tot alleen 'public'.
  select proconfig into v_config from pg_proc where oid = to_regprocedure('public.is_moderator()');
  if not exists (select 1 from unnest(v_config) as cfg where cfg like 'search_path=%auth%') then
    raise exception 'is_moderator() mist auth in zijn search_path na deze migratie.';
  end if;

  raise notice 'Alle % SECURITY DEFINER-functies in public hebben nu een vaste search_path (is_moderator() inclusief auth).', array_length(v_signatures, 1);
end $$;

commit;
