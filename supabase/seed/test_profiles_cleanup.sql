-- Removes every test profile created by test_profiles_seed.sql, and
-- nothing else - matches only the @sportfrend-test.nl e-mail domain that
-- script deliberately used specifically so this cleanup is unambiguous.
--
-- Deleting the auth.users rows cascades (on delete cascade, via
-- profiles.id -> auth.users(id), and every other table with personal
-- data in turn referencing profiles(id) the same way - see
-- supabase/functions/delete-account for the same mechanism used for a
-- real account) through profiles, swipes, matches, messages, posts,
-- post_likes, subscriptions, support_requests, reports and blocks in one
-- statement. These test profiles never had a photo_url set, so there's
-- nothing to clean up in Storage either.
--
-- Run this in the Supabase SQL Editor whenever you're done testing.

delete from auth.users
where email like '%@sportfrend-test.nl';
