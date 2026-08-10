-- Seeds 10 fake test profiles for manual testing (Ontdekken, matches,
-- chat, blocking/reporting, etc.) without needing to actually register 10
-- real accounts by hand.
--
-- NOT a schema migration - this is data, meant to be added and later
-- removed again (see test_profiles_cleanup.sql), which is why it lives in
-- supabase/seed/ rather than supabase/migrations/.
--
-- Run this in the Supabase SQL Editor. Safe to run more than once - an
-- email that already exists is skipped, not duplicated.
--
-- What this does per profile:
--   1. Inserts a row into auth.users directly (encrypted_password via
--      pgcrypto, email pre-confirmed so no confirmation e-mail is needed
--      to log in as one of these).
--   2. Inserts a matching auth.identities row (email provider) - not
--      strictly required for password sign-in, but keeps these looking
--      like normal accounts instead of a half-created edge case.
--   3. handle_new_user() (0001_init.sql's trigger on auth.users) fires
--      automatically and creates a bare public.profiles + public.
--      subscriptions row - this script then fills the profiles row in
--      with realistic test data (name, birthdate 18+, gender, sport,
--      level, city, coordinates, bio) and marks it onboarded/visible so
--      it actually shows up in Ontdekken.
--
-- All 10 use the @sportfrend-test.nl e-mail domain specifically so
-- they're trivially identifiable later (both to find them, and via
-- test_profiles_cleanup.sql's WHERE clause, which matches on exactly
-- this domain) - don't reuse this domain for anything real.
--
-- Test login password for all 10: TestSportfrend2026!
-- (change PASSWORD below before running if you'd rather use your own)

create extension if not exists pgcrypto with schema extensions;

do $$
declare
  test_password text := 'TestSportfrend2026!';
  r record;
  v_user_id uuid;
begin
  for r in
    select *
    from (
      values
        ('test1@sportfrend-test.nl',  'Sanne de Vries',  24, 'vrouw', 'Hardlopen',  'beginner',  'Amsterdam',   52.3702, 4.8952, 'Elke week een rondje langs de Amstel, altijd op zoek naar een vast hardloopmaatje.', array['di','do']),
        ('test2@sportfrend-test.nl',  'Daan Bakker',     29, 'man',   'Voetbal',    'gevorderd', 'Amsterdam',   52.3560, 4.8790, 'Speel al jaren op zaterdag, zoek ook doordeweeks een potje.', array['ma','wo','vr']),
        ('test3@sportfrend-test.nl',  'Fleur Jansen',    22, 'vrouw', 'Tennis',     'gemiddeld', 'Oudheusden',  51.6935, 5.1069, 'Tennis sinds mijn achtste, houd van een spannende wedstrijd.', array['za','zo']),
        ('test4@sportfrend-test.nl',  'Milan de Jong',   31, 'man',   'Basketbal',  'expert',    'Amsterdam',   52.3792, 4.9003, 'Ex-competitiespeler, geef ook weleens training. Altijd in voor een potje 3-tegen-3.', array['do','za']),
        ('test5@sportfrend-test.nl',  'Julia Visser',    26, 'vrouw', 'Yoga',       'beginner',  'Oudheusden',  51.6920, 5.1100, 'Net begonnen met yoga en op zoek naar rustige, geduldige lesgenoten.', array['ma','wo']),
        ('test6@sportfrend-test.nl',  'Sem van Dijk',    35, 'man',   'Wielrennen', 'gemiddeld', 'Amsterdam',   52.3450, 4.9100, 'Rijd zo''n 100 km per weekend, zoek gezelschap voor de lange ritten.', array['za']),
        ('test7@sportfrend-test.nl',  'Noa Smit',        20, 'vrouw', 'Zwemmen',    'gevorderd', 'Amsterdam',   52.3810, 4.8700, 'Vroeger wedstrijdzwemster, nu voor de lol maar nog steeds serieus.', array['di','do','zo']),
        ('test8@sportfrend-test.nl',  'Lucas Mulder',    27, 'man',   'Klimmen',    'expert',    'Oudheusden',  51.6950, 5.1030, 'Boulderen en op de rots, zoek een vaste klimpartner voor de weekenden.', array['za','zo']),
        ('test9@sportfrend-test.nl',  'Eva Willems',     40, 'vrouw', 'Hardlopen',  'gemiddeld', 'Amsterdam',   52.3600, 4.9300, 'Train voor mijn derde halve marathon, gezellig kletsen tijdens het lopen mag ook.', array['wo','za']),
        ('test10@sportfrend-test.nl', 'Bram Peters',     33, 'man',   'Voetbal',    'beginner',  'Oudheusden',  51.6900, 5.1150, 'Pas begonnen met voetballen op mijn werk, wil het serieuzer oppakken.', array['vr'])
    ) as t(email, full_name, age_years, gender, sport, level, city, lat, lng, bio, avail_days)
  loop
    if exists (select 1 from auth.users u where u.email = r.email) then
      raise notice 'Skipping %, already exists', r.email;
      continue;
    end if;

    insert into auth.users (
      instance_id, id, aud, role, email, encrypted_password,
      email_confirmed_at, created_at, updated_at,
      raw_app_meta_data, raw_user_meta_data, is_super_admin
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
      false
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

    raise notice 'Created test profile % (%)', r.full_name, r.email;
  end loop;
end $$;
