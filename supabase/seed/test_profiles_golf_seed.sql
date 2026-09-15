-- Seeds 10 more fake test profiles (golf1 t/m golf10@sportfrend-test.nl),
-- all sport = 'Golf', spread across Noord-Brabant (Eindhoven, Tilburg,
-- Den Bosch, Breda, Oudheusden) - same approach as test_profiles_seed.sql
-- / test_profiles_11_30_seed.sql, same @sportfrend-test.nl domain, same
-- test password, so all three batches are managed together.
--
-- NOT a schema migration - this is data, meant to be added and later
-- removed again (see the cleanup command at the bottom of this file, or
-- test_profiles_cleanup.sql which already matches the whole
-- @sportfrend-test.nl domain and therefore covers this batch too with no
-- changes needed), which is why it lives in supabase/seed/ rather than
-- supabase/migrations/.
--
-- Run this in the Supabase SQL Editor. Safe to run more than once - an
-- email that already exists is skipped, not duplicated (and since the
-- swipe/post inserts below only happen for a profile actually created in
-- this run, re-running never creates duplicate likes or posts either).
--
-- What this does per profile (same three steps as the earlier two seed
-- scripts):
--   1. Inserts a row into auth.users directly (encrypted_password via
--      pgcrypto, email pre-confirmed, and all eight token columns set to
--      '' rather than left NULL - see test_profiles_auth_repair.sql for
--      why a NULL there breaks login with a 500).
--   2. Inserts a matching auth.identities row (email provider).
--   3. handle_new_user() (0001_init.sql's trigger on auth.users) fires
--      automatically and creates a bare public.profiles + public.
--      subscriptions row - this script fills the profiles row in with
--      realistic golf test data (name, birthdate, gender, level, city,
--      coordinates, bio, availability, photo) and marks it onboarded/
--      visible.
--
-- Profile photos: `photo_url` is set to https://i.pravatar.cc/400?u=<email>
-- for all 10 - the exact same pravatar.cc service constants/placeholders.ts's
-- avatarPlaceholder() already falls back to when photo_url is null, just
-- now explicitly stored instead of left to the client-side fallback. This
-- gives each profile a distinct, realistic-looking human face for
-- screenshots; pravatar has no golf-specific imagery or gender control, so
-- treat this as "a real-looking photo per profile", not "a golfer
-- specifically" - the sport/bio text carries the golf theming instead. No
-- actual file is uploaded to Supabase Storage (these are plain external
-- URLs), so there's nothing extra to clean up there either.
--
-- Extra this time, per profile that opts in (see the `likes_floris` and
-- `post_text` columns in the VALUES list below) - 4 of the 10 register a
-- 'like' swipe toward target_email below so matches form immediately for
-- screenshots, and 2 of the 10 post a golf-themed message to public.posts:
--   4. golf1, golf2, golf4, golf6 like target_email.
--   5. golf2 and golf5 post a golf-themed message.
--
-- target_email is floris.reinders@gmail.com - the same account
-- test_profiles_11_30_seed.sql already targets for its own `likes_floris`
-- swipes, so this batch's matches show up next to those, not as a
-- separate/different target account.
--
-- Test login password for all 10 (same as the other batches):
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
    raise notice 'Account % not found - creating all 10 profiles, but skipping the "like" swipes toward it.', target_email;
  end if;

  for r in
    select *
    from (
      values
        ('golf1@sportfrend-test.nl',  'Peter Hermans',    34, 'man',   'gevorderd', 'Eindhoven',  51.4416, 5.4697, 'Speel al 10 jaar golf op de baan bij Eindhoven, handicap 14. Altijd in voor een rondje op zaterdagochtend.', array['za'],       true,  null),
        ('golf2@sportfrend-test.nl',  'Marleen Voss',     29, 'vrouw', 'beginner',  'Tilburg',    51.5555, 5.0913, 'Sinds dit voorjaar met golfles bezig en helemaal verkocht. Zoek geduldige medespelers om te oefenen.', array['zo'],       true,  'Wie heeft zin om zondag een rondje te golfen in Eindhoven?'),
        ('golf3@sportfrend-test.nl',  'Erik Roelofs',     45, 'man',   'expert',    'Den Bosch',  51.6978, 5.3037, 'Golf al 20 jaar, clubkampioen geweest in 2019. Geef ook weleens les aan beginners.', array['wo','za'], false, null),
        ('golf4@sportfrend-test.nl',  'Nadia Coenen',     26, 'vrouw', 'gemiddeld', 'Breda',      51.5719, 4.7683, 'Golf sinds mijn studietijd, speel het liefst 9 holes na werk. Gezelligheid staat voorop.', array['di','do'], true,  null),
        ('golf5@sportfrend-test.nl',  'Hans Rovers',      52, 'man',   'gevorderd', 'Oudheusden', 51.6935, 5.1069, 'Elke donderdag een vast rondje golf, op zoek naar extra spelers voor ons flightje.', array['do'],       false, 'Op zoek naar een vaste golfmaatje op donderdagmiddag in de regio Oudheusden.'),
        ('golf6@sportfrend-test.nl',  'Charlotte Pijnen', 31, 'vrouw', 'beginner',  'Eindhoven',  51.4380, 5.4750, 'Pas begonnen met golf via een bedrijfsuitje en nu verslaafd. Zoek rustige oefenmaatjes.', array['za','zo'], true,  null),
        ('golf7@sportfrend-test.nl',  'Rick Damen',       38, 'man',   'gemiddeld', 'Tilburg',    51.5590, 5.0850, 'Golf al een paar jaar, meestal in het weekend. Sta open voor een balletje doordeweeks ook.', array['ma','za'], false, null),
        ('golf8@sportfrend-test.nl',  'Sophie Kerkhof',   24, 'vrouw', 'beginner',  'Den Bosch',  51.6940, 5.3080, 'Net mijn eerste clinic gedaan, wil nu serieus aan de slag met mijn swing.', array['di'],       false, null),
        ('golf9@sportfrend-test.nl',  'Willem Storms',    47, 'man',   'expert',    'Breda',      51.5750, 4.7620, 'Golf al mijn hele leven, laag handicap. Geef graag tips maar hou ook van een ontspannen rondje.', array['vr','zo'], false, null),
        ('golf10@sportfrend-test.nl', 'Renske Achten',    33, 'vrouw', 'gevorderd', 'Oudheusden', 51.6900, 5.1040, 'Golf zo''n twee keer per maand, op zoek naar iemand om vaker te kunnen spelen.', array['zo'],       false, null)
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

    if r.likes_floris and v_target_id is not null then
      insert into public.swipes (swiper_id, swiped_id, direction)
      values (v_user_id, v_target_id, 'like')
      on conflict (swiper_id, swiped_id) do nothing;
    end if;

    if r.post_text is not null then
      insert into public.posts (author_id, body, sport)
      values (v_user_id, r.post_text, 'Golf');
    end if;

    raise notice 'Created test profile % (%)', r.full_name, r.email;
  end loop;
end $$;

-- ─────────────────────────────────────────────────────────────────────────
-- Opruimen: alleen deze golf-testprofielen (golf1 t/m golf10), niet de
-- test1-30-batches. Run dit los in de SQL Editor wanneer je klaar bent
-- met testen. (test_profiles_cleanup.sql's bredere
-- `where email like '%@sportfrend-test.nl'` verwijdert deze profielen ook
-- al, samen met alle andere batches - gebruik onderstaande query alleen
-- als je specifiek deze golf-batch wilt verwijderen zonder de rest aan te
-- raken.)
-- ─────────────────────────────────────────────────────────────────────────
-- delete from auth.users
-- where email like 'golf%@sportfrend-test.nl';
