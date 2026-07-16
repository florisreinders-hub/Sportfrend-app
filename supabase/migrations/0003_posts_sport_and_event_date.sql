-- The app's "Bericht plaatsen" screen currently writes to exactly two
-- optional posts columns: sport and event_date. Both are safe/no-ops if
-- already applied - run this regardless of what you've run before.
--
-- Why this file exists: event_date has been part of the table definition
-- since the very first migration (0001_init.sql), so it should already
-- exist. sport, however, was only added later, in the same batch as
-- event_time and location (0002_posts_sport_time_location.sql) - and that
-- migration turned out to not have been applied to the live database,
-- which is what caused "Could not find the 'event_time' column of 'posts'
-- in the schema cache". sport is exactly as exposed as event_time was: a
-- column the app writes to that only exists if 0002 was actually run.
--
-- The app no longer uses posts.event_time or posts.location - a post's
-- "wanneer" is now the single optional event_date column (date only, no
-- time-of-day). If you already ran 0002, those two extra columns are
-- simply unused now - harmless to leave in place, no need to remove them.
--
-- Run this via `supabase db push` or paste into the Supabase SQL editor.
-- Safe to run more than once, and safe regardless of whether 0002 was
-- run before.

alter table public.posts add column if not exists sport text;
alter table public.posts add column if not exists event_date date;
