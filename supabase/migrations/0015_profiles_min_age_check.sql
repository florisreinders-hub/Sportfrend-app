-- Minimum age at registration: rejects any birthdate implying under 18,
-- at the database level - this is the enforcement boundary that can't be
-- bypassed even by a modified/malicious client calling the API directly.
-- RegisterDetailsScreen (app/auth/RegisterDetailsScreen.tsx) already
-- validates this client-side for immediate feedback and requires a
-- birthdate to be filled in (it's no longer optional there), but this
-- constraint is what actually makes the rule unavoidable.
--
-- `birthdate is null or ...`: this does NOT make a birthdate optional at
-- the database level - it only blocks a *present but underage* value.
-- Nulls are still allowed because handle_new_user() (0001_init.sql)
-- inserts a bare profile row with no birthdate yet, before the client's
-- own follow-up upsert (which does include a real birthdate) - a NOT NULL
-- requirement here would break every single registration at that first
-- insert, before the client ever gets a chance to fill anything in.
--
-- Uses `current_date - interval '18 years'` rather than a fixed date, so
-- the cutoff moves forward automatically as time passes - safe despite
-- referencing current_date: for a fixed birthdate, this expression can
-- only ever go from "not yet old enough" to "old enough" as time passes,
-- never the other way around, so it can never make an already-valid row
-- retroactively invalid on some later, unrelated update.
--
-- Run this via `supabase db push` or paste into the Supabase SQL editor.
-- Safe to run more than once. 0001_init.sql has been updated to match for
-- fresh installs.
--
-- Note: if any existing row already has a birthdate implying under 18,
-- this ALTER TABLE will fail with a check_violation until that row is
-- fixed - Postgres validates a new CHECK constraint against all existing
-- rows when it's added. Run this to find any such rows first if the
-- ALTER below fails:
--   select id, birthdate from public.profiles
--   where birthdate is not null and birthdate > (current_date - interval '18 years');

alter table public.profiles drop constraint if exists profiles_birthdate_min_age_check;
alter table public.profiles add constraint profiles_birthdate_min_age_check
  check (birthdate is null or birthdate <= (current_date - interval '18 years'));
