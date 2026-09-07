-- Seeds 20 more fake test profiles (test11 t/m test30@sportfrend-test.nl),
-- on top of the 10 from test_profiles_seed.sql - same approach, same
-- domain, same test password, so both batches are managed together.
--
-- NOT a schema migration - this is data, meant to be added and later
-- removed again (see test_profiles_cleanup.sql, which already matches
-- the whole @sportfrend-test.nl domain and therefore covers this batch
-- too with no changes needed), which is why it lives in supabase/seed/
-- rather than supabase/migrations/.
--
-- Run this in the Supabase SQL Editor. Safe to run more than once - an
-- email that already exists is skipped, not duplicated (and since the
-- swipe/post inserts below only happen for a profile actually created in
-- this run, re-running never creates duplicate likes or posts either).
--
-- What this does per profile (same three steps as test_profiles_seed.sql):
--   1. Inserts a row into auth.users directly (encrypted_password via
--      pgcrypto, email pre-confirmed).
--   2. Inserts a matching auth.identities row (email provider).
--   3. handle_new_user() (0001_init.sql's trigger on auth.users) fires
--      automatically and creates a bare public.profiles + public.
--      subscriptions row - this script fills the profiles row in with
--      realistic test data and marks it onboarded/visible.
--
-- Extra this time, per profile that opts in (see the `likes_floris` and
-- `post_text` columns in the VALUES list below):
--   4. ~8 of the 20 register a 'like' swipe (public.swipes) toward the
--      account with e-mail floris.reinders@gmail.com - swipe straight
--      back at one of them while testing and a match forms immediately,
--      no need to wait for a reciprocal swipe from a script.
--   5. ~5 of the 20 post a message (public.posts) with realistic text,
--      for testing the Connecties tab's feed.
--
-- Test login password for all 20 (same as the first 10):
-- TestSportfrend2026!

create extension if not exists pgcrypto with schema extensions;

do $$
declare
  test_password text := 'TestSportfrend2026!';
  target_email text := 'floris.reinders@gmail.com';
  r record;
  v_user_id uuid;
  v_target_id uuid;
begin
  select id into v_target_id from auth.users where email = target_email;
  if v_target_id is null then
    raise notice 'Account % not found - creating all 20 profiles, but skipping the "like" swipes toward it.', target_email;
  end if;

  for r in
    select *
    from (
      values
        ('test11@sportfrend-test.nl', 'Tim Hendriks',       25, 'man',   'Padel',      'gemiddeld', 'Amsterdam',  52.3650, 4.8850, 'Speel elke week padel met een vast groepje, altijd ruimte voor meer.', array['di','za'], true,  null),
        ('test12@sportfrend-test.nl', 'Anne Koster',        28, 'vrouw', 'Golf',       'beginner',  'Oudheusden', 51.6910, 5.1080, 'Net mijn golfbaanpermissie gehaald, op zoek naar geduldige medespelers.', array['zo'], false, 'Wie heeft zin om zondag een balletje te golfen? Beginners zijn ook welkom!'),
        ('test13@sportfrend-test.nl', 'Ruben Smits',        32, 'man',   'Fitness',    'expert',    'Amsterdam',  52.3730, 4.8920, 'Krachttraining is mijn ding, geef ook weleens tips aan beginners in de sportschool.', array['ma','wo','vr'], true, null),
        ('test14@sportfrend-test.nl', 'Roos Bos',           23, 'vrouw', 'Volleybal',  'gevorderd', 'Amsterdam',  52.3480, 4.9050, 'Speel al jaren op recreatief niveau, houd van een fanatieke wedstrijd.', array['do'], false, null),
        ('test15@sportfrend-test.nl', 'Thijs Dekker',       21, 'man',   'Badminton',  'beginner',  'Oudheusden', 51.6960, 5.1120, 'Pas begonnen met badminton, zoek iemand om samen te oefenen.', array['di'], true, null),
        ('test16@sportfrend-test.nl', 'Lisa Kuipers',       29, 'vrouw', 'Squash',     'gemiddeld', 'Amsterdam',  52.3620, 4.8980, 'Squash is een goede stressverlichting na werk, zoek een vaste sparringpartner.', array['do','zo'], false, 'Zin in een potje squash donderdagavond? Alle niveaus welkom!'),
        ('test17@sportfrend-test.nl', 'Niek Verhoeven',     34, 'man',   'Crossfit',   'expert',    'Amsterdam',  52.3805, 4.9120, 'Crossfit al 6 jaar, geef ook af en toe les. Altijd op zoek naar nieuwe uitdagingen.', array['ma','wo','vr'], true, null),
        ('test18@sportfrend-test.nl', 'Anna Scholten',      24, 'vrouw', 'Padel',      'beginner',  'Oudheusden', 51.6890, 5.0990, 'Sinds kort verslingerd aan padel, kom graag een keer spelen.', array['za','zo'], false, 'Wie heeft zin om te padellen dit weekend?'),
        ('test19@sportfrend-test.nl', 'Boaz de Groot',      30, 'man',   'Voetbal',    'gemiddeld', 'Amsterdam',  52.3510, 4.8830, 'Speel zaalvoetbal op dinsdag, op zoek naar extra spelers voor ons team.', array['di'], true, null),
        ('test20@sportfrend-test.nl', 'Merel van der Berg', 22, 'vrouw', 'Hardlopen',  'gevorderd', 'Amsterdam',  52.3670, 4.9150, 'Loop hard, het liefst ''s ochtends vroeg. Bereid me voor op mijn eerste marathon.', array['ma','wo','vr'], false, 'Ga zondagochtend een rondje hardlopen langs het Vondelpark, wie doet mee?'),
        ('test21@sportfrend-test.nl', 'Sven Hermans',       36, 'man',   'Tennis',     'expert',    'Oudheusden', 51.6970, 5.1000, 'Tennis al mijn hele leven, competitiespeler, sta open voor een potje voor de lol.', array['za'], true, null),
        ('test22@sportfrend-test.nl', 'Iris Peeters',       27, 'vrouw', 'Yoga',       'gemiddeld', 'Amsterdam',  52.3590, 4.8890, 'Doe graag vinyasa yoga, op zoek naar gelijkgestemden voor een ochtendlesje.', array['di','do'], false, null),
        ('test23@sportfrend-test.nl', 'Dex van Leeuwen',    20, 'man',   'Basketbal',  'beginner',  'Amsterdam',  52.3830, 4.9010, 'Speel nog niet zo lang basketbal maar wil graag beter worden.', array['wo','vr'], true, null),
        ('test24@sportfrend-test.nl', 'Fenna Verbeek',      31, 'vrouw', 'Wielrennen', 'gevorderd', 'Oudheusden', 51.6930, 5.1150, 'Fiets het liefst lange toertochten in het weekend, op zoek naar gezelschap.', array['za','zo'], false, 'Wie fietst er mee dit weekend? Rustig tempo, gezellig samen onderweg.'),
        ('test25@sportfrend-test.nl', 'Owen Willemsen',     25, 'man',   'Zwemmen',    'gemiddeld', 'Amsterdam',  52.3695, 4.8760, 'Zwem drie keer per week baantjes, op zoek naar een zwemmaatje voor motivatie.', array['ma','do'], true, null),
        ('test26@sportfrend-test.nl', 'Yara Kramer',        29, 'vrouw', 'Klimmen',    'expert',    'Amsterdam',  52.3540, 4.9200, 'Klim al jaren, zowel binnen als buiten. Altijd in voor een nieuwe route.', array['za','zo'], false, null),
        ('test27@sportfrend-test.nl', 'Cas Meijer',         26, 'man',   'Golf',       'beginner',  'Oudheusden', 51.6880, 5.1040, 'Nieuw op de golfbaan, op zoek naar iemand die geduld heeft met een beginner.', array['zo'], false, null),
        ('test28@sportfrend-test.nl', 'Feline Kok',         23, 'vrouw', 'Volleybal',  'gemiddeld', 'Amsterdam',  52.3765, 4.8930, 'Speel recreatief volleybal, gezelligheid staat bij mij voorop.', array['do'], false, null),
        ('test29@sportfrend-test.nl', 'Job Aarts',          33, 'man',   'Fitness',    'gevorderd', 'Amsterdam',  52.3625, 4.9070, 'Sport vijf keer per week, focus op krachttraining. Zoek een trainingsmaatje voor motivatie.', array['ma','di','do'], false, null),
        ('test30@sportfrend-test.nl', 'Lotte Sanders',      22, 'vrouw', 'Padel',      'beginner',  'Oudheusden', 51.6945, 5.1055, 'Padel is mijn nieuwe hobby, kom graag een potje spelen met leuke mensen.', array['za'], false, null)
    ) as t(email, full_name, age_years, gender, sport, level, city, lat, lng, bio, avail_days, likes_floris, post_text)
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
      -- Supabase's own signup flow always writes '' here, never leaves
      -- these NULL - GoTrue's Go code scans them into a plain (non-
      -- nullable) string, so a NULL in any of these makes every future
      -- /auth/v1/token request for this account fail with a 500 ("Scan
      -- error ... converting NULL to string is unsupported"). Omitting
      -- them from the insert (the previous version of this script) left
      -- them at the column's default, which for confirmation_token/
      -- recovery_token/email_change/email_change_token_new is NULL, not ''.
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
      sport = r.sport,
      level = r.level,
      city = r.city,
      latitude = r.lat,
      longitude = r.lng,
      is_onboarded = true,
      profile_visible = true,
      availability_days = r.avail_days
    where id = v_user_id;

    if r.likes_floris and v_target_id is not null then
      insert into public.swipes (swiper_id, swiped_id, direction)
      values (v_user_id, v_target_id, 'like')
      on conflict (swiper_id, swiped_id) do nothing;
    end if;

    if r.post_text is not null then
      insert into public.posts (author_id, body, sport)
      values (v_user_id, r.post_text, r.sport);
    end if;

    raise notice 'Created test profile % (%)', r.full_name, r.email;
  end loop;
end $$;
