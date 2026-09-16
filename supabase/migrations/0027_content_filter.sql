-- Basale automatische filter voor aanstootgevende content, ter
-- voorbereiding op Apple's App Store Review Guideline 1.2 (User-Generated
-- Content), die van apps met UGC verlangt dat ze objectionable content
-- kunnen filteren en een manier hebben om het te verwijderen. Dit dekt
-- allebei: gefilterde content wordt hier gemarkeerd (niet geweigerd, zie
-- de afweging hieronder) in `flagged_content`, klaar om in een
-- moderatie-overzicht (aparte taak) te tonen/te verwijderen.
--
-- ─────────────────────────────────────────────────────────────────────────
-- Afweging: waarschuwen-met-doorsturen vs. hard blokkeren
-- ─────────────────────────────────────────────────────────────────────────
-- Deze migratie kiest bewust voor "waarschuwen + toch kunnen versturen +
-- markeren voor review", niet voor hard blokkeren. Redenen:
--
-- 1. Een simpele woordenlijst-filter heeft onvermijdelijk valse
--    positieven (het "Scunthorpe-probleem": een net-niet-onschuldig woord
--    kan een verboden deelwoord bevatten). Zelfs met woordgrens-matching
--    (hieronder) blijven woorden als "geiten" (bevat "geil"-achtige
--    klank, niet matchend hier maar het principe geldt breder) of
--    sportgerelateerde/persoonsnaam-toevalstreffers mogelijk. Hard
--    blokkeren op zo'n treffer weigert legitieme content zonder enige
--    beroepsmogelijkheid - slecht voor een klein team zonder eigen
--    moderatiedashboard (nog) om zulke false positives snel te herstellen.
-- 2. Apple's richtlijn 1.2 vraagt niet om harde pre-publicatie-blokkade;
--    de combinatie van "filter + melden + contentverwijdering/ban door de
--    developer" (die dit project al heeft: reports/blocks, zie
--    0012_moderation_reports_blocks.sql) voldoet. Een markering die in een
--    toekomstig moderatie-overzicht verschijnt, is dus voldoende én
--    minder risicovol dan blind blokkeren.
-- 3. Consistent met de rest van dit project: harde afdwinging via RLS is
--    hier gereserveerd voor misbruik met een duidelijke, ondubbelzinnige
--    grens (dagelijkse limieten, plan-gating) - een inhoudsoordeel over
--    "is dit woord aanstootgevend in deze context" is dat niet, en hoort
--    bij een mens (moderator), niet bij een keihard filter.
--
-- Wél hard afgedwongen, en niet te omzeilen door de client over te
-- slaan: het *markeren* zelf. Dat gebeurt via een AFTER INSERT/UPDATE-
-- trigger op elke tabel (niet via de client), dus een aangepaste client
-- die de client-side waarschuwing overslaat, slaat nooit de markering
-- zelf over - alleen de "wil je het toch versturen?"-waarschuwing is
-- puur UX, de audit trail in `flagged_content` is dat niet.
--
-- Run dit via `supabase db push` of plak het in de Supabase SQL editor.
-- Veilig om vaker te draaien (alles is `create or replace`/`if not
-- exists`, en elke policy/trigger wordt eerst gedropt).
--
-- ─────────────────────────────────────────────────────────────────────────
-- Verify na het draaien:
-- ─────────────────────────────────────────────────────────────────────────
-- select
--   (select count(*) from public.content_filter_words) as word_count,
--   (select count(*) from pg_proc where proname = 'find_flagged_words'
--      and pronamespace = 'public'::regnamespace) as has_check_fn,
--   (select count(*) from pg_proc where proname = 'flag_content_if_needed'
--      and pronamespace = 'public'::regnamespace) as has_trigger_fn,
--   (select count(*) from pg_trigger where tgname = 'flag_bio_content' and not tgisinternal) as has_profiles_trigger,
--   (select count(*) from pg_trigger where tgname = 'flag_message_content' and not tgisinternal) as has_messages_trigger,
--   (select count(*) from pg_trigger where tgname = 'flag_post_content' and not tgisinternal) as has_posts_trigger,
--   (select count(*) from pg_trigger where tgname = 'flag_training_content' and not tgisinternal) as has_trainings_trigger,
--   public.find_flagged_words('die training was echt kut vandaag') as test_match,
--   public.find_flagged_words('een heel normale nette bio zonder problemen') as test_no_match;
-- -- expect: word_count > 0, 1, 1, 1, 1, 1, 1, {kut}, {}
-- -- Let op: woordgrens-matching (\m...\M) is bewust een heel-woord-match,
-- -- geen substring - "kutzooi" (aan elkaar geschreven) matcht dus NIET op
-- -- "kut", net zoals "raster" niet matcht op "ras". Dat is precies het
-- -- gedrag dat valse positieven voorkomt (zie de afweging hierboven).

-- ─────────────────────────────────────────────────────────────────────────
-- content_filter_words: de woordenlijst zelf - uitbreiden/aanpassen kan
-- volledig via SQL (insert/update/delete op deze tabel), zonder ooit een
-- app-release nodig te hebben. Uitgeschakelde woorden op inactive zetten
-- in plaats van verwijderen, zodat de geschiedenis van eerdere treffers
-- (flagged_content, hieronder) zinvol leesbaar blijft.
-- ─────────────────────────────────────────────────────────────────────────
create table if not exists public.content_filter_words (
  id uuid primary key default uuid_generate_v4(),
  word text not null,
  language text not null check (language in ('nl', 'en')),
  category text not null check (category in ('scheldwoord', 'seksueel', 'haatdragend')),
  active boolean not null default true,
  created_at timestamptz not null default now(),
  unique (word, language)
);

alter table public.content_filter_words enable row level security;
-- Bewust geen policies voor `authenticated` - deze tabel is alleen
-- beheerd via directe SQL-toegang (SQL editor/migraties), niet via de
-- app. find_flagged_words() hieronder is `security definer` en leest hem
-- daarom zonder dat `authenticated` er zelf SELECT op nodig heeft - de
-- ruwe woordenlijst blijft zo onzichtbaar voor de client (triviaal te
-- omzeilen als je hem kent), terwijl de check-functie er wél gebruik van
-- kan maken.

-- Basisset: Nederlands + Engels, scheldwoorden/seksueel expliciet/
-- haatdragend. Bewust compact (geen duizenden woorden) om valse
-- positieven te beperken - uitbreiden kan altijd via een simpele insert,
-- zie de "Uitbreiden" sectie in README.md.
insert into public.content_filter_words (word, language, category) values
  -- Nederlands - scheldwoorden
  ('klootzak', 'nl', 'scheldwoord'),
  ('klootviool', 'nl', 'scheldwoord'),
  ('kutwijf', 'nl', 'scheldwoord'),
  ('kuttenkop', 'nl', 'scheldwoord'),
  ('hoerenjong', 'nl', 'scheldwoord'),
  ('rotzak', 'nl', 'scheldwoord'),
  ('kankerlijer', 'nl', 'scheldwoord'),
  ('kankerhoer', 'nl', 'scheldwoord'),
  ('teringlijer', 'nl', 'scheldwoord'),
  ('tyfuslijer', 'nl', 'scheldwoord'),
  ('klote', 'nl', 'scheldwoord'),
  ('kut', 'nl', 'scheldwoord'),
  ('lul', 'nl', 'scheldwoord'),
  ('eikel', 'nl', 'scheldwoord'),
  ('trut', 'nl', 'scheldwoord'),
  ('hoer', 'nl', 'scheldwoord'),
  ('slet', 'nl', 'scheldwoord'),
  ('klootzakken', 'nl', 'scheldwoord'),
  -- Nederlands - seksueel expliciet
  ('neuken', 'nl', 'seksueel'),
  ('neuk', 'nl', 'seksueel'),
  ('geneukt', 'nl', 'seksueel'),
  ('sperma', 'nl', 'seksueel'),
  ('kutneuken', 'nl', 'seksueel'),
  ('pornoslet', 'nl', 'seksueel'),
  ('tieten', 'nl', 'seksueel'),
  -- Nederlands - haatdragend
  ('mongool', 'nl', 'haatdragend'),
  ('kankerhomo', 'nl', 'haatdragend'),
  ('flikker', 'nl', 'haatdragend'),
  ('kutmarokkaan', 'nl', 'haatdragend'),
  ('kankerjood', 'nl', 'haatdragend'),
  ('kutneger', 'nl', 'haatdragend'),
  ('scheldkanker', 'nl', 'haatdragend'),
  -- Engels - scheldwoorden
  ('fuck', 'en', 'scheldwoord'),
  ('fucker', 'en', 'scheldwoord'),
  ('motherfucker', 'en', 'scheldwoord'),
  ('bitch', 'en', 'scheldwoord'),
  ('asshole', 'en', 'scheldwoord'),
  ('bastard', 'en', 'scheldwoord'),
  ('dumbass', 'en', 'scheldwoord'),
  ('douchebag', 'en', 'scheldwoord'),
  ('piece of shit', 'en', 'scheldwoord'),
  ('shithead', 'en', 'scheldwoord'),
  -- Engels - seksueel expliciet
  ('cunt', 'en', 'seksueel'),
  ('cock', 'en', 'seksueel'),
  ('dick', 'en', 'seksueel'),
  ('pussy', 'en', 'seksueel'),
  ('whore', 'en', 'seksueel'),
  ('slut', 'en', 'seksueel'),
  ('cum', 'en', 'seksueel'),
  ('blowjob', 'en', 'seksueel'),
  ('handjob', 'en', 'seksueel'),
  -- Engels - haatdragend
  ('nigger', 'en', 'haatdragend'),
  ('nigga', 'en', 'haatdragend'),
  ('faggot', 'en', 'haatdragend'),
  ('retard', 'en', 'haatdragend'),
  ('retarded', 'en', 'haatdragend'),
  ('spic', 'en', 'haatdragend'),
  ('chink', 'en', 'haatdragend'),
  ('kike', 'en', 'haatdragend'),
  ('tranny', 'en', 'haatdragend')
on conflict (word, language) do nothing;

-- find_flagged_words: het eigenlijke matchen - woordgrens-matching
-- (\m...\M, Postgres' regex-equivalent van "heel woord", niet zomaar een
-- kale substring) om overmatige valse positieven te beperken (bv. "ras"
-- matcht niet binnen "raster"). `security definer` zodat `authenticated`
-- dit kan aanroepen (voor de client-side waarschuwing vóór versturen)
-- zonder zelf SELECT op de ruwe woordenlijst nodig te hebben.
create or replace function public.find_flagged_words(p_text text)
returns text[]
language sql
security definer
set search_path = public
stable
as $$
  select coalesce(array_agg(distinct w.word), '{}'::text[])
  from public.content_filter_words w
  where w.active
    and p_text is not null
    and p_text ~* ('\m' || regexp_replace(w.word, '([.^$*+?()\[\]{}\\|])', '\\\1', 'g') || '\M');
$$;

grant execute on function public.find_flagged_words(text) to authenticated;

-- flagged_content: audit trail van elke keer dat find_flagged_words() een
-- treffer gaf bij het opslaan van bio/bericht/post/trainingsopmerking -
-- zie de "Afweging" hierboven voor waarom dit content niet weigert, en
-- de "Hard afgedwongen" alinea voor waarom dit wél altijd gebeurt,
-- ongeacht wat de client doet.
create table if not exists public.flagged_content (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  source_table text not null check (source_table in ('profiles', 'messages', 'posts', 'trainings')),
  source_id uuid not null,
  matched_words text[] not null,
  reason text,
  status text not null default 'pending' check (status in ('pending', 'reviewed', 'dismissed')),
  created_at timestamptz not null default now()
);

create index if not exists flagged_content_status_idx on public.flagged_content (status);
create index if not exists flagged_content_user_id_idx on public.flagged_content (user_id);

alter table public.flagged_content enable row level security;
-- Bewust geen policies - net als `reports` op dit moment ("Alleen de
-- melder zelf kan zijn eigen rapportages lezen" geldt hier zelfs niet:
-- een gebruiker mag zijn eigen flags niet eens zien, dat zou het
-- filterwoord weglekken) is dit uitsluitend voor moderatie via directe
-- service-role-toegang, tot taak 2 (moderatie-overzicht) een eigen
-- moderator-gerichte policy toevoegt.

-- flag_content_if_needed: de trigger-functie zelf - kijkt welke tabel
-- hem aanriep (TG_TABLE_NAME) om de juiste tekstkolom en eigenaar-kolom
-- te pakken, en schrijft bij een treffer een rij naar flagged_content.
-- Slaat NOOIT de INSERT/UPDATE zelf over (altijd `return NEW`) - dat is
-- precies de "waarschuwen, niet blokkeren"-afweging hierboven, nu op
-- database-niveau in plaats van alleen client-side.
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
    insert into public.flagged_content (user_id, source_table, source_id, matched_words, reason)
    values (v_user_id, TG_TABLE_NAME, NEW.id, v_matched, 'Automatisch gedetecteerd door woordenlijst-filter');
  end if;

  return NEW;
end;
$$;

-- Alleen op INSERT, en op UPDATE alleen wanneer de relevante tekstkolom
-- daadwerkelijk in de UPDATE-statement zit (`update of <kolom>`) - zonder
-- dat zou bv. elke keer dat iemand zijn Ontdekken-zichtbaarheid toggelt
-- (een heel andere kolom op profiles) een overbodige herscan van de bio
-- triggeren.
drop trigger if exists flag_bio_content on public.profiles;
create trigger flag_bio_content
  after insert or update of bio on public.profiles
  for each row execute function public.flag_content_if_needed();

drop trigger if exists flag_message_content on public.messages;
create trigger flag_message_content
  after insert on public.messages
  for each row execute function public.flag_content_if_needed();

drop trigger if exists flag_post_content on public.posts;
create trigger flag_post_content
  after insert on public.posts
  for each row execute function public.flag_content_if_needed();

drop trigger if exists flag_training_content on public.trainings;
create trigger flag_training_content
  after insert or update of note on public.trainings
  for each row execute function public.flag_content_if_needed();

-- ─────────────────────────────────────────────────────────────────────────
-- Self-check: raist een specifieke EXCEPTION i.p.v. een dubbelzinnige
-- "Success" - zelfde aanpak als 0022/0023/0024/0026.
-- ─────────────────────────────────────────────────────────────────────────
do $$
declare
  v_test_match text[];
  v_test_no_match text[];
begin
  if to_regclass('public.content_filter_words') is null then
    raise exception 'public.content_filter_words bestaat niet - is het CREATE TABLE hierboven wel gedraaid?';
  end if;

  if (select count(*) from public.content_filter_words) = 0 then
    raise exception 'public.content_filter_words is leeg - de basiswoordenlijst is niet ingevoegd.';
  end if;

  if not exists (select 1 from pg_proc where proname = 'find_flagged_words' and pronamespace = 'public'::regnamespace) then
    raise exception 'find_flagged_words() bestaat niet.';
  end if;

  if to_regclass('public.flagged_content') is null then
    raise exception 'public.flagged_content bestaat niet.';
  end if;

  if not exists (select 1 from pg_proc where proname = 'flag_content_if_needed' and pronamespace = 'public'::regnamespace) then
    raise exception 'flag_content_if_needed() bestaat niet.';
  end if;

  if not exists (select 1 from pg_trigger where tgname = 'flag_bio_content' and not tgisinternal) then
    raise exception 'De trigger flag_bio_content op profiles ontbreekt.';
  end if;

  if not exists (select 1 from pg_trigger where tgname = 'flag_message_content' and not tgisinternal) then
    raise exception 'De trigger flag_message_content op messages ontbreekt.';
  end if;

  if not exists (select 1 from pg_trigger where tgname = 'flag_post_content' and not tgisinternal) then
    raise exception 'De trigger flag_post_content op posts ontbreekt.';
  end if;

  if not exists (select 1 from pg_trigger where tgname = 'flag_training_content' and not tgisinternal) then
    raise exception 'De trigger flag_training_content op trainings ontbreekt.';
  end if;

  -- Functioneel: de matcher moet een bekend testwoord vinden en een
  -- onschuldige zin niet ten onrechte raken. Let op: "kut" als los woord
  -- (niet als "kutzooi" aan elkaar - woordgrens-matching (\m...\M) is
  -- bewust een heel-woord-match, geen substring, zie de afweging boven in
  -- dit bestand).
  v_test_match := public.find_flagged_words('die training was echt kut vandaag');
  if array_length(v_test_match, 1) is null or not ('kut' = any(v_test_match)) then
    raise exception 'find_flagged_words() vond "kut" niet in een testzin die het woord als los woord bevat - matcher werkt niet correct.';
  end if;

  v_test_no_match := public.find_flagged_words('een heel normale nette bio zonder problemen');
  if array_length(v_test_no_match, 1) is not null then
    raise exception 'find_flagged_words() gaf een valse positief op een onschuldige testzin: %.', v_test_no_match;
  end if;

  if has_function_privilege('authenticated', 'public.find_flagged_words(text)', 'execute') is not true then
    raise exception 'authenticated kan find_flagged_words() niet aanroepen - de client-side waarschuwing vóór versturen zou altijd falen.';
  end if;

  raise notice 'content_filter_words (% woorden), find_flagged_words(), flagged_content, flag_content_if_needed() en alle vier de triggers zijn correct opgezet.', (select count(*) from public.content_filter_words);
end $$;
