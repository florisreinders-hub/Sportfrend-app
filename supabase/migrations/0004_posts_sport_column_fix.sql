-- "Could not find the 'sport' column of 'posts' in the schema cache" keeps
-- being reported even after 0002/0003 already contained the fix for it -
-- this migration exists purely so there is one unambiguous, definitely-
-- current script to run, regardless of whether an earlier one was ever
-- actually executed against the live database.
--
-- Verified before writing this file (nothing here is guessed):
--   1. The exact column name the app writes to: lib/api.ts's createPost()
--      does `.from("posts").insert({ ..., sport: fields.sport ?? null, ... })`
--      - the column is named `sport`, no typo, matches what's below.
--   2. Every existing migration was checked for a matching `create table`/
--      `add column` for `posts.sport` (0001_init.sql's inline table
--      definition, 0002_posts_sport_time_location.sql, and
--      0003_posts_sport_and_event_date.sql all already add it) - and for
--      any DROP COLUMN or RENAME COLUMN on posts.sport that could undo
--      that. There is none anywhere in supabase/migrations/.
--   3. The Supabase project the published app actually talks to (read
--      from the EAS "preview" environment, the same one `eas update`
--      publishes against) is project ref duefdlibkeghdskongjd
--      (https://duefdlibkeghdskongjd.supabase.co) - the same one in this
--      repo's local .env. Make sure the SQL below is run in *that*
--      project's SQL Editor (Supabase dashboard -> confirm the project
--      name/ref in the top-left matches duefdlibkeghdskongjd before
--      running it).
--
-- The conclusion: the column was simply never added to the live database.
-- This statement is the same one from 0003, repeated here as its own
-- migration, plus an explicit schema-cache reload so PostgREST picks up
-- the change immediately instead of waiting for its own refresh cycle.
--
-- Run this via `supabase db push` or paste into the Supabase SQL editor.
-- Safe to run more than once.

alter table public.posts add column if not exists sport text;

notify pgrst, 'reload schema';
