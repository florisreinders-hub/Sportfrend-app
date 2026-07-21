-- Adds "Gemiddeld" as a fourth Niveau option (Beginner, Gemiddeld,
-- Gevorderd, Expert) and renames the former 'competitief' value to
-- 'expert' to match.
--
-- Existing rows with level = 'competitief' are renamed to 'expert' first -
-- required, not optional: Postgres validates a new/replaced check
-- constraint against every existing row, so leaving any row at the old
-- 'competitief' value would make the new constraint fail to apply at all.
--
-- Run this via `supabase db push` or paste into the Supabase SQL editor.
-- Safe to run more than once.

update public.profiles set level = 'expert' where level = 'competitief';

alter table public.profiles drop constraint if exists profiles_level_check;
alter table public.profiles add constraint profiles_level_check
  check (level in ('beginner', 'gemiddeld', 'gevorderd', 'expert'));
