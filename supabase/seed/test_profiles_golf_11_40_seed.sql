-- Seeds 30 more fake golf test profiles (golf11 t/m golf40@sportfrend-test.nl),
-- all sport = 'Golf', spread across Noord-Brabant (Eindhoven, Tilburg, Den
-- Bosch, Breda, Oudheusden, plus a handful of nearby towns for variety:
-- Waalwijk, Helmond, Oosterhout, Vught, Best, Loon op Zand) - same
-- approach as test_profiles_golf_seed.sql (golf1-golf10), same
-- @sportfrend-test.nl domain, same test password, so all batches are
-- managed together.
--
-- NOT a schema migration - this is data, meant to be added and later
-- removed again (see test_profiles_cleanup.sql, which already matches the
-- whole @sportfrend-test.nl domain and therefore covers this batch too
-- with no changes needed), which is why it lives in supabase/seed/ rather
-- than supabase/migrations/.
--
-- Run this in the Supabase SQL Editor. Safe to run more than once - an
-- email that already exists is skipped, not duplicated (and since the
-- swipe/post inserts below only happen for a profile actually created in
-- this run, re-running never creates duplicate likes or posts either).
--
-- What this does per profile (same three steps as the earlier golf
-- batch):
--   1. Inserts a row into auth.users directly (encrypted_password via
--      pgcrypto, email pre-confirmed, and all eight token columns set to
--      '' rather than left NULL - see test_profiles_auth_repair.sql for
--      why a NULL there breaks login with a 500).
--   2. Inserts a matching auth.identities row (email provider).
--   3. handle_new_user() (0001_init.sql's trigger on auth.users) fires
--      automatically and creates a bare public.profiles + public.
--      subscriptions row - this script fills the profiles row in with
--      realistic golf test data (name, birthdate 18+, gender, level,
--      city, coordinates, bio, availability, photo) and marks it
--      onboarded/visible.
--
-- Profile photos: `photo_url` is set to https://i.pravatar.cc/400?u=<email>
-- for all 30 - same pravatar.cc service constants/placeholders.ts's
-- avatarPlaceholder() already falls back to when photo_url is null, just
-- now explicitly stored instead of left to the client-side fallback. No
-- actual file is uploaded to Supabase Storage (these are plain external
-- URLs), so there's nothing extra to clean up there either.
--
-- Extra this time, per profile that opts in (see the `likes_floris` and
-- `post_text` columns in the VALUES list below) - 10 of the 30 register a
-- 'like' swipe toward target_email below so matches form immediately, and
-- 6 of the 30 post a golf-themed message to public.posts:
--   4. golf11, golf13, golf15, golf18, golf21, golf24, golf27, golf30,
--      golf33, golf37 like target_email.
--   5. golf12, golf16, golf20, golf25, golf29, golf34 post a golf-themed
--      message.
--
-- All bio/post text below is plain, everyday Dutch about golf - checked
-- by hand against the word list in 0027_content_filter.sql (word-boundary
-- matching, so only a whole banned word would ever trigger) and nothing
-- in this file matches, so 0028_content_filter_hard_block.sql's
-- BEFORE-triggers never fire for these inserts. If you ever edit the text
-- below, re-check it against that list (or just run this script - the
-- self-check query at the very bottom confirms no row silently got
-- dropped by the trigger).
--
-- target_email is floris.reinders@gmail.com - the same account
-- test_profiles_golf_seed.sql (golf1-golf10) and test_profiles_11_30_seed.sql
-- already target for their own `likes_floris` swipes, so this batch's
-- matches show up next to those, not as a separate/different target
-- account.
--
-- Test login password for all 30 (same as the other batches):
-- TestSportfrend2026!

create extension if not exists pgcrypto with schema extensions;

do $$
declare
  test_password text := 'TestSportfrend2026!';
  target_email text := 'floris.reinders@gmail.com';
  r record;
  v_user_id uuid;
  v_post_id uuid;
  v_target_id uuid;
  v_created_count int := 0;
begin
  select id into v_target_id from auth.users where email = target_email;
  if v_target_id is null then
    raise notice 'Account % not found - creating all 30 profiles, but skipping the "like" swipes toward it.', target_email;
  end if;

  for r in
    select *
    from (
      values
        ('golf11@sportfrend-test.nl', 'Bram Jaspers',       41, 'man',   'gevorderd', 'Eindhoven',     51.4416, 5.4697, 'Golf sinds mijn twintigste, handicap 11. Speel het liefst vroeg in de ochtend voor het druk wordt.', array['za'],       true,  null),
        ('golf12@sportfrend-test.nl', 'Femke Willemsen',    27, 'vrouw', 'beginner',  'Tilburg',       51.5555, 5.0913, 'Net m''n baanpermissie gehaald en nu op zoek naar leuke mensen om samen te oefenen.', array['zo'],       false, 'Ben net begonnen met golf en zoek een rustige golfmaatje om samen te oefenen in de regio Tilburg!'),
        ('golf13@sportfrend-test.nl', 'Dennis Kuijpers',    35, 'man',   'gemiddeld', 'Den Bosch',     51.6978, 5.3037, 'Speel een paar keer per maand, meestal in het weekend. Gezelligheid en een goed gesprek onderweg staan voorop.', array['wo','za'], true,  null),
        ('golf14@sportfrend-test.nl', 'Anouk Gijsbers',     30, 'vrouw', 'gevorderd', 'Breda',         51.5719, 4.7683, 'Golf al jaren op dezelfde club, houd van een strategisch rondje. Altijd in voor een nieuwe golfmaatje.', array['di','do'], false, null),
        ('golf15@sportfrend-test.nl', 'Tom Verhoeven',      48, 'man',   'expert',    'Oudheusden',    51.6935, 5.1069, 'Laag handicap, speel al meer dan 25 jaar. Geef af en toe tips maar hou het vooral ontspannen.', array['vr'],       true,  null),
        ('golf16@sportfrend-test.nl', 'Lisa Brekelmans',    24, 'vrouw', 'beginner',  'Waalwijk',      51.6889, 5.0728, 'Sinds kort golfles en helemaal enthousiast. Op zoek naar rustige oefenmaatjes.', array['za','zo'], false, 'Wie heeft er zin om een keer samen naar de driving range te gaan? Nog volop aan het oefenen.'),
        ('golf17@sportfrend-test.nl', 'Kevin Smulders',     33, 'man',   'gemiddeld', 'Helmond',       51.4793, 5.6570, 'Golf sinds mijn studietijd, meestal 9 holes na werk. Sta open voor doordeweeks een balletje.', array['ma','wo'], false, null),
        ('golf18@sportfrend-test.nl', 'Sanne van Dongen',   29, 'vrouw', 'gevorderd', 'Oosterhout',    51.6453, 4.8567, 'Speel al tien jaar, hou van een vroege starttijd op zaterdag. Zoek een vast flightje.', array['za'],       true,  null),
        ('golf19@sportfrend-test.nl', 'Bart Kolen',         52, 'man',   'expert',    'Vught',         51.6547, 5.2925, 'Clubkampioen geweest, geef nu vooral les aan beginners. Altijd bereid om mee te spelen.', array['do'],       false, null),
        ('golf20@sportfrend-test.nl', 'Iris Mertens',       22, 'vrouw', 'beginner',  'Best',          51.5075, 5.3908, 'Pas begonnen via een clinic op het werk en meteen verkocht. Zoek geduldige medespelers.', array['zo'],       false, 'Op zoek naar iemand die net als ik nog aan het leren is - samen oefenen is toch leuker.'),
        ('golf21@sportfrend-test.nl', 'Joost Verbeek',      39, 'man',   'gemiddeld', 'Loon op Zand',  51.6333, 5.0667, 'Golf al een aantal jaar, meestal in het weekend. Reageer graag op een spontaan balletje.', array['vr','za'], true,  null),
        ('golf22@sportfrend-test.nl', 'Nienke Schoenmakers',26, 'vrouw', 'gevorderd', 'Eindhoven',     51.4460, 5.4630, 'Speel regelmatig na werk, houd van een snel rondje van negen holes.', array['di'],       false, null),
        ('golf23@sportfrend-test.nl', 'Maarten Rijkers',    44, 'man',   'gemiddeld', 'Tilburg',       51.5620, 5.0850, 'Golf sinds een jaar of acht, meestal met vaste maten. Nieuwe gezichten altijd welkom.', array['za'],       false, null),
        ('golf24@sportfrend-test.nl', 'Eva Vermeulen',      31, 'vrouw', 'beginner',  'Den Bosch',     51.6920, 5.2990, 'Net begonnen met privelessen, wil m''n swing verbeteren. Zoek relaxte oefenpartners.', array['wo'],       true,  null),
        ('golf25@sportfrend-test.nl', 'Stijn Kuenen',       27, 'man',   'gevorderd', 'Breda',         51.5780, 4.7750, 'Golf sinds mijn zestiende, speel het liefst competitief maar ook gewoon voor de lol.', array['za','zo'], false, 'Zin in een balletje golf dit weekend in de buurt van Breda? Alle niveaus welkom.'),
        ('golf26@sportfrend-test.nl', 'Roos Dekkers',       36, 'vrouw', 'gemiddeld', 'Oudheusden',    51.6900, 5.1030, 'Speel graag op donderdagavond na werk. Op zoek naar een vast rondje.', array['do'],       false, null),
        ('golf27@sportfrend-test.nl', 'Niels Aerts',        50, 'man',   'expert',    'Waalwijk',      51.6850, 5.0690, 'Golf al mijn hele leven, laag handicap maar vooral voor het plezier.', array['za'],       true,  null),
        ('golf28@sportfrend-test.nl', 'Fleur Hendriks',     23, 'vrouw', 'beginner',  'Helmond',       51.4830, 5.6620, 'Sinds kort lid van de club, nog veel te leren. Zoek geduldige medespelers voor het weekend.', array['zo'],       false, null),
        ('golf29@sportfrend-test.nl', 'Daan Verbruggen',    34, 'man',   'gevorderd', 'Oosterhout',    51.6490, 4.8620, 'Speel al jaren met wisselende maten, houd van een strategisch potje op een lastige baan.', array['za'],       false, 'Wie speelt er regelmatig in de regio Oosterhout? Op zoek naar een vast flightje voor het weekend.'),
        ('golf30@sportfrend-test.nl', 'Julia Konings',      28, 'vrouw', 'gemiddeld', 'Vught',         51.6580, 5.2970, 'Golf sinds mijn studietijd, meestal in het weekend. Gezelligheid staat voorop.', array['zo'],       true,  null),
        ('golf31@sportfrend-test.nl', 'Wesley Bogaers',     46, 'man',   'expert',    'Best',          51.5110, 5.3950, 'Laag handicap, speel het liefst vroeg in de ochtend voor het rustig is.', array['za'],       false, null),
        ('golf32@sportfrend-test.nl', 'Merel Timmermans',   25, 'vrouw', 'beginner',  'Loon op Zand',  51.6370, 5.0710, 'Net m''n eerste lessen gehad, op zoek naar rustige oefenmaatjes in de buurt.', array['wo'],       false, null),
        ('golf33@sportfrend-test.nl', 'Sander Oomen',       38, 'man',   'gemiddeld', 'Eindhoven',     51.4390, 5.4780, 'Speel een paar keer per maand, meestal in het weekend met vrienden.', array['za','zo'], true,  null),
        ('golf34@sportfrend-test.nl', 'Naomi Kuypers',      32, 'vrouw', 'gevorderd', 'Tilburg',       51.5490, 5.0990, 'Golf al een tijdje serieus, houd van een uitdagende baan en goed gezelschap.', array['do'],       false, 'Golf al een tijdje serieus en zoek een vaste partner om samen aan mijn spel te werken.'),
        ('golf35@sportfrend-test.nl', 'Robin Leenders',     55, 'man',   'expert',    'Den Bosch',     51.7010, 5.3100, 'Golf al meer dan dertig jaar, geef af en toe les maar speel vooral voor het plezier.', array['za'],       false, null),
        ('golf36@sportfrend-test.nl', 'Esther van Gils',    21, 'vrouw', 'beginner',  'Breda',         51.5660, 4.7600, 'Sinds dit jaar aan het golfen via een introductiecursus, nog volop aan het oefenen.', array['zo'],       false, null),
        ('golf37@sportfrend-test.nl', 'Pieter Meeuwissen',  42, 'man',   'gemiddeld', 'Oudheusden',    51.6970, 5.1100, 'Golf sinds een jaar of tien, meestal donderdagmiddag. Nieuwe golfmaatjes altijd welkom.', array['do'],       true,  null),
        ('golf38@sportfrend-test.nl', 'Chantal Boere',      37, 'vrouw', 'gevorderd', 'Waalwijk',      51.6920, 5.0770, 'Speel regelmatig op de lokale baan, houd van een goed getimede swing en gezelligheid.', array['za'],       false, null),
        ('golf39@sportfrend-test.nl', 'Luuk Panken',        58, 'man',   'expert',    'Helmond',       51.4760, 5.6510, 'Golf al mijn hele volwassen leven, laag handicap. Speel graag met nieuwe mensen.', array['vr'],       false, null),
        ('golf40@sportfrend-test.nl', 'Vera Smeets',        30, 'vrouw', 'gemiddeld', 'Oosterhout',    51.6420, 4.8510, 'Golf sinds een paar jaar, meestal in het weekend. Op zoek naar een gezellig vast flightje.', array['za','zo'], false, null)
    ) as t(email, full_name, age_years, gender, level, city, lat, lng, bio, avail_days, likes_floris, post_text)
  loop
    if exists (select 1 from auth.users u where u.email = r.email) then
      raise notice 'Skipping %, already exists', r.email;
      continue;
    end if;

    insert into auth.users (
      instance_id, id, aud, role, email, encrypted_password,
      email_confirmed_at, created_at, updated_at,
      raw_app_meta_data, raw_user_meta_data, is_super_admin,
      confirmation_token, recovery_token, email_change, email_change_token_new,
      email_change_token_current, phone_change, phone_change_token, reauthentication_token
    ) values (
      '00000000-0000-0000-0000-000000000000',
      gen_random_uuid(),
      'authenticated',
      'authenticated',
      r.email,
      extensions.crypt(test_password, extensions.gen_salt('bf')),
      now(), now(), now(),
      '{"provider":"email","providers":["email"]}'::jsonb,
      '{}'::jsonb,
      false,
      -- See test_profiles_auth_repair.sql: Supabase's own signup flow
      -- always writes '' here, never leaves these NULL, so all eight
      -- token columns are set explicitly rather than omitted.
      '', '', '', '', '', '', '', ''
    )
    returning id into v_user_id;

    insert into auth.identities (
      provider_id, user_id, identity_data, provider, last_sign_in_at, created_at, updated_at
    ) values (
      v_user_id::text,
      v_user_id,
      jsonb_build_object('sub', v_user_id::text, 'email', r.email),
      'email',
      now(), now(), now()
    );

    -- handle_new_user() already inserted a bare profiles row (and a
    -- 'basis' subscription) for v_user_id by this point - fill it in.
    update public.profiles set
      full_name = r.full_name,
      birthdate = (current_date - (r.age_years || ' years')::interval)::date,
      gender = r.gender,
      bio = r.bio,
      sport = 'Golf',
      level = r.level,
      city = r.city,
      latitude = r.lat,
      longitude = r.lng,
      is_onboarded = true,
      profile_visible = true,
      availability_days = r.avail_days,
      photo_url = 'https://i.pravatar.cc/400?u=' || r.email
    where id = v_user_id;

    -- flag_bio_content (0028_content_filter_hard_block.sql) fires on this
    -- UPDATE (it touches bio) - if the BEFORE-trigger had cancelled it,
    -- the bio above would silently not be saved. Bail out loudly instead
    -- of leaving a half-seeded profile if that ever happens (it shouldn't
    -- - see the header comment's note on the wordlist check).
    if not exists (select 1 from public.profiles where id = v_user_id and bio = r.bio) then
      raise exception 'Bio voor % (%) is niet opgeslagen - mogelijk geweigerd door de contentfilter (0028). Controleer de tekst.', r.full_name, r.email;
    end if;

    if r.likes_floris and v_target_id is not null then
      insert into public.swipes (swiper_id, swiped_id, direction)
      values (v_user_id, v_target_id, 'like')
      on conflict (swiper_id, swiped_id) do nothing;
    end if;

    if r.post_text is not null then
      insert into public.posts (author_id, body, sport)
      values (v_user_id, r.post_text, 'Golf')
      returning id into v_post_id;
      if not found then
        raise exception 'Post voor % (%) is niet aangemaakt - mogelijk geweigerd door de contentfilter (0028). Controleer de tekst.', r.full_name, r.email;
      end if;
    end if;

    v_created_count := v_created_count + 1;
    raise notice 'Created test profile % (%)', r.full_name, r.email;
  end loop;

  raise notice '% of 30 golf11-golf40 profiles created (the rest already existed and were skipped).', v_created_count;
end $$;

-- ─────────────────────────────────────────────────────────────────────────
-- Controlequery: bevestigt dat alle 30 profielen goed zijn aangemaakt, en
-- dat het aantal likes/posts overeenkomt met wat hierboven bedoeld is.
-- ─────────────────────────────────────────────────────────────────────────
select
  (select count(*) from auth.users where email like 'golf%@sportfrend-test.nl' and email ~ '^golf(1[1-9]|[23][0-9]|40)@')
    as golf_11_40_profiles,
  (select count(*) from public.profiles p
     join auth.users u on u.id = p.id
     where u.email like 'golf%@sportfrend-test.nl' and u.email ~ '^golf(1[1-9]|[23][0-9]|40)@'
       and p.sport = 'Golf' and p.is_onboarded and p.profile_visible)
    as golf_11_40_onboarded_visible,
  (select count(*) from public.swipes s
     join auth.users u on u.id = s.swiper_id
     join auth.users t on t.id = s.swiped_id
     where u.email like 'golf%@sportfrend-test.nl' and u.email ~ '^golf(1[1-9]|[23][0-9]|40)@'
       and t.email = 'floris.reinders@gmail.com' and s.direction = 'like')
    as likes_toward_floris,
  (select count(*) from public.posts po
     join auth.users u on u.id = po.author_id
     where u.email like 'golf%@sportfrend-test.nl' and u.email ~ '^golf(1[1-9]|[23][0-9]|40)@')
    as golf_11_40_posts;
-- verwacht: 30, 30, 10, 6 (bij een schone eerste run - bestaande e-mails
-- worden overgeslagen, dus na een herhaalde run blijven deze tellingen
-- hetzelfde in plaats van te verdubbelen)

-- ─────────────────────────────────────────────────────────────────────────
-- Opruimen: alleen deze golf-testprofielen (golf11 t/m golf40), niet de
-- golf1-10- of test1-30-batches. Run dit los in de SQL Editor wanneer je
-- klaar bent met testen. (test_profiles_cleanup.sql's bredere
-- `where email like '%@sportfrend-test.nl'` verwijdert deze profielen ook
-- al, samen met alle andere batches - gebruik onderstaande query alleen
-- als je specifiek deze batch wilt verwijderen zonder de rest aan te
-- raken.)
-- ─────────────────────────────────────────────────────────────────────────
-- delete from auth.users
-- where email ~ '^golf(1[1-9]|[23][0-9]|40)@sportfrend-test\.nl$';
