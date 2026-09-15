-- One-time repair for test accounts created by test_profiles_seed.sql /
-- test_profiles_11_30_seed.sql BEFORE this fix: those scripts inserted
-- into auth.users without setting confirmation_token, recovery_token,
-- email_change, and email_change_token_new, which left them at the
-- column's database default - NULL, not '' - for those four columns.
--
-- Supabase's own signup flow always writes '' there, never NULL. GoTrue
-- (Supabase Auth) scans these columns into a plain (non-nullable) Go
-- string, so a NULL causes every future request that has to read this
-- user's auth.users row - including a normal password login - to fail
-- with a 500 ("Database error querying schema" / a Scan error converting
-- NULL to string). This is exactly why logging in as a real, normally-
-- registered account works, but a @sportfrend-test.nl test account gives
-- a 500 from /auth/v1/token?grant_type=password: the real account was
-- always created via Supabase's own signup API (which sets '' for all of
-- these), while these test accounts were inserted by hand and missed
-- them.
--
-- This UPDATE only ever changes a column that's currently NULL (via
-- coalesce - never touches a column that's already correctly set to ''
-- or something else), and only targets the @sportfrend-test.nl domain, so
-- it's safe to run against a project that also has real user accounts.
--
-- Run this once in the Supabase SQL editor to fix the already-created
-- test accounts. No need to recreate them - this repairs them in place,
-- and test_profiles_seed.sql / test_profiles_11_30_seed.sql have also
-- been fixed so re-running them (or seeding again after
-- test_profiles_cleanup.sql) won't reintroduce this.

update auth.users set
  confirmation_token = coalesce(confirmation_token, ''),
  recovery_token = coalesce(recovery_token, ''),
  email_change = coalesce(email_change, ''),
  email_change_token_new = coalesce(email_change_token_new, ''),
  email_change_token_current = coalesce(email_change_token_current, ''),
  phone_change = coalesce(phone_change, ''),
  phone_change_token = coalesce(phone_change_token, ''),
  reauthentication_token = coalesce(reauthentication_token, '')
where email like '%@sportfrend-test.nl';
