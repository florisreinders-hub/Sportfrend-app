-- Verandert de contentfilter (0027_content_filter.sql) van "waarschuwen +
-- toch kunnen versturen + markeren" naar hard blokkeren: expliciete
-- productbeslissing die de afweging in 0027 vervangt (niet omdat die
-- afweging fout was, maar omdat de eigenaar nu bewust voor de striktere
-- variant kiest). find_flagged_words(), content_filter_words en
-- flagged_content zelf blijven ongewijzigd - alleen flag_content_if_needed()
-- en de vier triggers veranderen.
--
-- ─────────────────────────────────────────────────────────────────────────
-- Hoe het hard blokkeren werkt (en waarom flagged_content toch een audit
-- trail blijft, ook al wordt de content zelf nooit opgeslagen)
-- ─────────────────────────────────────────────────────────────────────────
-- De triggers worden BEFORE-triggers (was: AFTER). Bij een treffer:
--   1. schrijft de triggerfunctie eerst een rij naar `flagged_content`
--      (dezelfde tabel, dezelfde kolommen als voorheen - alleen betekent
--      een rij hier voortaan altijd "geweigerde poging", nooit meer
--      "opgeslagen én gemarkeerd");
--   2. geeft daarna `return NULL` in plaats van `return NEW`.
--
-- `return NULL` in een BEFORE-trigger is Postgres' ingebouwde manier om een
-- INSERT/UPDATE van die ene rij stilletjes te annuleren - zonder een fout
-- op te werpen die de hele transactie (inclusief de zojuist geschreven
-- flagged_content-rij) terugdraait. Dat is precies waarom voor `return
-- NULL` gekozen is in plaats van `raise exception`: een `raise exception`
-- had de audit-log-insert uit stap 1 ook ongedaan gemaakt (Postgres kent
-- geen "onafhankelijke" subtransactie binnen dezelfde triggeraanroep zonder
-- een aparte databaseverbinding, bv. via de dblink-extensie - een
-- complexiteit/afhankelijkheid die hier niet nodig is).
--
-- Een geannuleerde INSERT/UPDATE meldt zichzelf bij de client niet als een
-- druk PostgreSQL-foutbericht, maar simpelweg als "0 rijen geraakt". Om dat
-- clientside betrouwbaar als weigering te herkennen (in plaats van een
-- stille no-op die de gebruiker laat denken dat het gelukt is), moet elke
-- schrijfactie een `.select().single()` gebruiken: PostgREST geeft dan een
-- expliciete fout (code PGRST116, "0 rows") zodra er geen rij teruggegeven
-- kan worden. `sendMessage()`, `createTraining()` en
-- `updateTrainingProposal()` (lib/api.ts) deden dit al; `createPost()` en
-- de profiel-upsert in EditProfileScreen.tsx zijn in dezelfde commit
-- aangepast om ook `.select().single()` te gebruiken, anders zou een
-- geblokkeerde post/bio-wijziging clientside stil "slagen".
--
-- Client-side (lib/contentFilter.ts) blijft find_flagged_words() vooraf
-- aanroepen zodat de gebruiker meteen een duidelijke melding krijgt zonder
-- ooit de server te bereiken; de trigger hierboven is puur het
-- server-side vangnet voor een client die deze check overslaat (gewijzigde
-- app, directe API-aanroep) - dié poging wordt nu ook echt geweigerd, niet
-- alleen client-side afgeraden.
--
-- Run dit via `supabase db push` of plak het in de Supabase SQL editor.
-- Veilig om vaker te draaien (`create or replace function`, en elke
-- trigger wordt eerst gedropt).
--
-- ─────────────────────────────────────────────────────────────────────────
-- Verify na het draaien:
-- ─────────────────────────────────────────────────────────────────────────
-- select
--   tgname,
--   case when tgtype & 2 = 2 then 'BEFORE' else 'AFTER' end as timing
-- from pg_trigger
-- where tgname in ('flag_bio_content', 'flag_message_content', 'flag_post_content', 'flag_training_content')
--   and not tgisinternal
-- order by tgname;
-- -- verwacht: alle vier op 'BEFORE' (was 'AFTER' vóór deze migratie)
--
-- select pg_get_functiondef('public.flag_content_if_needed()'::regprocedure) ilike '%return null%' as hard_blocks;
-- -- verwacht: true
-- ─────────────────────────────────────────────────────────────────────────

create or replace function public.flag_content_if_needed()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_text text;
  v_user_id uuid;
  v_matched text[];
begin
  if TG_TABLE_NAME = 'messages' then
    v_text := NEW.body;
    v_user_id := NEW.sender_id;
  elsif TG_TABLE_NAME = 'posts' then
    v_text := NEW.body;
    v_user_id := NEW.author_id;
  elsif TG_TABLE_NAME = 'trainings' then
    v_text := NEW.note;
    v_user_id := NEW.created_by;
  elsif TG_TABLE_NAME = 'profiles' then
    v_text := NEW.bio;
    v_user_id := NEW.id;
  else
    raise exception 'flag_content_if_needed() is not configured for table %', TG_TABLE_NAME;
  end if;

  if v_text is null then
    return NEW;
  end if;

  v_matched := public.find_flagged_words(v_text);

  if array_length(v_matched, 1) > 0 then
    -- NEW.id is op dit punt al gevuld (kolomdefaults worden door Postgres
    -- toegepast vóórdat een BEFORE-trigger draait), ook al wordt deze rij
    -- zelf nooit daadwerkelijk weggeschreven - source_id is dus voor een
    -- geweigerde INSERT een "ongebruikt" maar wel uniek id, en voor een
    -- geweigerde UPDATE het echte id van de bestaande (ongewijzigd
    -- gebleven) rij.
    insert into public.flagged_content (user_id, source_table, source_id, matched_words, reason)
    values (v_user_id, TG_TABLE_NAME, NEW.id, v_matched, 'Automatisch geweigerd door woordenlijst-filter (hard block)');

    return NULL;
  end if;

  return NEW;
end;
$$;

-- BEFORE in plaats van AFTER (was het enige verschil met 0027's triggers) -
-- zelfde kolomscoping als voorheen (`update of <kolom>`, niet elke UPDATE).
drop trigger if exists flag_bio_content on public.profiles;
create trigger flag_bio_content
  before insert or update of bio on public.profiles
  for each row execute function public.flag_content_if_needed();

drop trigger if exists flag_message_content on public.messages;
create trigger flag_message_content
  before insert on public.messages
  for each row execute function public.flag_content_if_needed();

drop trigger if exists flag_post_content on public.posts;
create trigger flag_post_content
  before insert on public.posts
  for each row execute function public.flag_content_if_needed();

drop trigger if exists flag_training_content on public.trainings;
create trigger flag_training_content
  before insert or update of note on public.trainings
  for each row execute function public.flag_content_if_needed();

-- ─────────────────────────────────────────────────────────────────────────
-- Self-check: raist een specifieke EXCEPTION i.p.v. een dubbelzinnige
-- "Success" - zelfde aanpak als 0022/0023/0024/0026/0027.
-- ─────────────────────────────────────────────────────────────────────────
do $$
declare
  v_timing text;
begin
  if not exists (select 1 from pg_proc where proname = 'flag_content_if_needed' and pronamespace = 'public'::regnamespace) then
    raise exception 'flag_content_if_needed() bestaat niet.';
  end if;

  if pg_get_functiondef('public.flag_content_if_needed()'::regprocedure) not ilike '%return null%' then
    raise exception 'flag_content_if_needed() bevat geen "return null" - de hard-block-aanpassing lijkt niet toegepast.';
  end if;

  select case when tgtype & 2 = 2 then 'BEFORE' else 'AFTER' end into v_timing
  from pg_trigger where tgname = 'flag_bio_content' and not tgisinternal;
  if v_timing is distinct from 'BEFORE' then
    raise exception 'flag_bio_content is geen BEFORE-trigger (gevonden: %) - hard block staat niet aan.', coalesce(v_timing, 'trigger ontbreekt');
  end if;

  select case when tgtype & 2 = 2 then 'BEFORE' else 'AFTER' end into v_timing
  from pg_trigger where tgname = 'flag_message_content' and not tgisinternal;
  if v_timing is distinct from 'BEFORE' then
    raise exception 'flag_message_content is geen BEFORE-trigger (gevonden: %) - hard block staat niet aan.', coalesce(v_timing, 'trigger ontbreekt');
  end if;

  select case when tgtype & 2 = 2 then 'BEFORE' else 'AFTER' end into v_timing
  from pg_trigger where tgname = 'flag_post_content' and not tgisinternal;
  if v_timing is distinct from 'BEFORE' then
    raise exception 'flag_post_content is geen BEFORE-trigger (gevonden: %) - hard block staat niet aan.', coalesce(v_timing, 'trigger ontbreekt');
  end if;

  select case when tgtype & 2 = 2 then 'BEFORE' else 'AFTER' end into v_timing
  from pg_trigger where tgname = 'flag_training_content' and not tgisinternal;
  if v_timing is distinct from 'BEFORE' then
    raise exception 'flag_training_content is geen BEFORE-trigger (gevonden: %) - hard block staat niet aan.', coalesce(v_timing, 'trigger ontbreekt');
  end if;

  raise notice 'flag_content_if_needed() en alle vier de triggers zijn omgezet naar hard block (BEFORE + return NULL).';
end $$;
