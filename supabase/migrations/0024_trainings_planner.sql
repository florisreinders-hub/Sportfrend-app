-- "Trainings & Buddy Planner" (Pricing screen, Elite-only): lets an Elite
-- account propose a concrete training (date/time/sport/location/note) to
-- a match from inside the chat. It shows up as a special card in the chat
-- for both participants (not a plain text message - see
-- ChatDetailScreen.tsx merging `messages` and `trainings` into one sorted
-- list), with "Accepteren"/"Voorstel wijzigen" (and a smaller "Afwijzen")
-- for whoever didn't propose it. Accepted trainings also show up under
-- Instellingen -> "Mijn trainingen" for either participant, regardless of
-- their own plan - only *creating* a proposal is Elite-gated (requirement:
-- "alleen Elite-accounts mogen een rij aanmaken"), not responding to one
-- someone else already made.
--
-- reminder_sent_at isn't part of the four requested columns but is added
-- here anyway: without some "already reminded?" marker, the periodic
-- reminder job (0025_training_reminder_cron.sql) would send a duplicate
-- push every time its schedule ticks again during a training's "starts in
-- 2 hours" window - this column is what claim_training_reminders() below
-- uses to claim each training's reminder exactly once, atomically.
--
-- Run this via `supabase db push` or paste into the Supabase SQL editor.
-- Safe to run more than once (every object below is created with `if not
-- exists`/`or replace`, or guarded in a `do $$ ... $$` check).
--
-- ─────────────────────────────────────────────────────────────────────────
-- Verify after applying:
-- ─────────────────────────────────────────────────────────────────────────
-- select
--   (select count(*) from pg_proc where proname = 'has_elite_access'
--      and pronamespace = 'public'::regnamespace) as has_elite_access_fn,
--   (select count(*) from pg_proc where proname = 'claim_training_reminders'
--      and pronamespace = 'public'::regnamespace) as has_reminder_fn,
--   (select count(*) from pg_policies where schemaname = 'public' and tablename = 'trainings'
--      and policyname = 'Elite match participants can propose trainings'
--      and with_check ilike '%has_elite_access%') as insert_policy_elite_gated,
--   (select count(*) from pg_policies where schemaname = 'public' and tablename = 'trainings') as trainings_policy_count,
--   (select count(*) from pg_publication_tables where pubname = 'supabase_realtime'
--      and schemaname = 'public' and tablename = 'trainings') as realtime_enabled,
--   has_function_privilege('authenticated', 'public.claim_training_reminders(int)', 'execute') as authenticated_can_call_reminder_fn,
--   has_function_privilege('anon', 'public.claim_training_reminders(int)', 'execute') as anon_can_call_reminder_fn,
--   has_function_privilege('service_role', 'public.claim_training_reminders(int)', 'execute') as service_role_can_call_reminder_fn;
-- -- expect: 1, 1, 1, 3, 1, false, false, true

create table if not exists public.trainings (
  id uuid primary key default uuid_generate_v4(),
  match_id uuid not null references public.matches (id) on delete cascade,
  created_by uuid not null references public.profiles (id) on delete cascade,
  date date not null,
  time time not null,
  sport text,
  location text,
  note text,
  status text not null default 'pending' check (status in ('pending', 'accepted', 'declined')),
  created_at timestamptz not null default now(),
  -- see the file header comment above for why this exists
  reminder_sent_at timestamptz
);

alter table public.trainings enable row level security;

-- has_elite_access: single source of truth for "may this caller use an
-- Elite-only feature" - mirrors has_posts_access() (0022_posts_premium_only.sql)
-- exactly, just checking plan = 'elite' instead of plan in ('premium', 'elite').
create or replace function public.has_elite_access()
returns boolean
language plpgsql
security definer
set search_path = public
stable
as $$
declare
  v_uid uuid := auth.uid();
begin
  if v_uid is null then
    return false;
  end if;

  return exists (
    select 1 from public.subscriptions s
    where s.user_id = v_uid and s.status = 'active' and s.plan = 'elite'
  );
end;
$$;

grant execute on function public.has_elite_access() to authenticated;

drop policy if exists "Match participants can read trainings" on public.trainings;
create policy "Match participants can read trainings"
  on public.trainings for select
  to authenticated
  using (
    exists (
      select 1 from public.matches m
      where m.id = trainings.match_id
        and (m.user_a_id = auth.uid() or m.user_b_id = auth.uid())
    )
  );

-- The actual Elite-only enforcement (requirement 6): even a hand-built
-- INSERT that skips ChatDetailScreen's UI entirely still needs
-- has_elite_access() to pass, exactly like has_posts_access() gates
-- "Users manage their own posts" for the prikbord.
drop policy if exists "Elite match participants can propose trainings" on public.trainings;
create policy "Elite match participants can propose trainings"
  on public.trainings for insert
  to authenticated
  with check (
    created_by = auth.uid()
    and public.has_elite_access()
    and exists (
      select 1 from public.matches m
      where m.id = match_id
        and (m.user_a_id = auth.uid() or m.user_b_id = auth.uid())
    )
  );

-- Deliberately NOT Elite-gated - responding to (accept/decline) or
-- countering ("voorstel wijzigen") an existing proposal is not "creating"
-- one, so a Basis/Premium recipient of an Elite match's proposal can still
-- reply. `with check` still ties the new created_by to one of the two
-- match participants, so a caller can't reassign a training to an
-- unrelated third party.
drop policy if exists "Match participants can respond to trainings" on public.trainings;
create policy "Match participants can respond to trainings"
  on public.trainings for update
  to authenticated
  using (
    exists (
      select 1 from public.matches m
      where m.id = trainings.match_id
        and (m.user_a_id = auth.uid() or m.user_b_id = auth.uid())
    )
  )
  with check (
    exists (
      select 1 from public.matches m
      where m.id = match_id
        and (m.user_a_id = auth.uid() or m.user_b_id = auth.uid())
        and (created_by = m.user_a_id or created_by = m.user_b_id)
    )
  );

-- claim_training_reminders: called every ~5 minutes by the
-- send-training-reminder-push Edge Function (via the pg_cron job in
-- 0025_training_reminder_cron.sql), never by a regular signed-in user -
-- granted to service_role only, not authenticated. Atomically claims
-- (marks reminder_sent_at) every accepted training whose start time falls
-- in the next [2h, 2h + p_window_minutes) window in one UPDATE ... RETURNING,
-- so two overlapping/retried cron ticks can never double-send the same
-- training's reminder.
create or replace function public.claim_training_reminders(p_window_minutes int default 5)
returns table (
  id uuid,
  match_id uuid,
  date date,
  -- "time" (unlike "date") isn't safely usable unquoted as a column name
  -- immediately followed by its own type in a RETURNS TABLE(...) column
  -- list - `time time` fails with "syntax error at or near time" even
  -- though the exact same `time time` column definition is fine inside a
  -- plain CREATE TABLE (see the trainings table itself, further up this
  -- file). Quoting only here works around that grammar quirk; every other
  -- reference to this column (t.time, the trainings table's own column
  -- definition, PostgREST/lib/api.ts's `time`) stays a normal unquoted
  -- lowercase identifier - Postgres folds unquoted and `"time"` to the
  -- same identifier, so this doesn't create a second, distinct column.
  "time" time,
  sport text,
  location text,
  user_a_id uuid,
  user_b_id uuid
)
language sql
set search_path = public
as $$
  update public.trainings t
  set reminder_sent_at = now()
  from public.matches m
  where m.id = t.match_id
    and t.status = 'accepted'
    and t.reminder_sent_at is null
    -- date/time are entered as Europe/Amsterdam wall-clock (the app has no
    -- other timezone handling anywhere else either) - interpreting them
    -- explicitly as that zone before comparing to now() (always UTC) is
    -- what keeps this correct across the CET/CEST switch, rather than
    -- silently comparing naive local time against UTC.
    and ((t.date + t.time) at time zone 'Europe/Amsterdam')
        between now() + interval '2 hours'
            and now() + interval '2 hours' + make_interval(mins => p_window_minutes)
  returning t.id, t.match_id, t.date, t.time, t.sport, t.location, m.user_a_id, m.user_b_id;
$$;

-- Unlike has_posts_access()/discover_profiles()/etc. elsewhere in this
-- codebase, this one is NOT `security definer` (it needs to cross every
-- user's trainings/matches rows, not just the caller's own, so there's no
-- legitimate per-user scope to define it down to), so its only real
-- access boundary is who is allowed to call it at all.
--
-- Every Supabase project (not just this one - it's set up once at project
-- creation, nothing any migration in this repo controls) runs, roughly:
--   alter default privileges in schema public
--     grant all on functions to postgres, anon, authenticated, service_role;
-- which means a newly created function in `public` gets EXECUTE granted
-- *directly* to anon/authenticated/service_role the moment it's created -
-- not inherited through the PUBLIC pseudo-role at all. A plain
-- `revoke execute ... from public` (what this migration originally did)
-- therefore revokes a grant that was never actually the source of
-- authenticated's access, and does nothing: authenticated keeps its own,
-- separate, directly-granted EXECUTE privilege regardless. The self-check
-- below is exactly what caught this ("authenticated can still execute
-- claim_training_reminders()") - the fix is revoking from anon and
-- authenticated explicitly, not just from public.
revoke execute on function public.claim_training_reminders(int) from public, anon, authenticated;
grant execute on function public.claim_training_reminders(int) to service_role;

-- ─────────────────────────────────────────────────────────────────────────
-- Realtime: broadcast changes on trainings so an accept/decline/"voorstel
-- wijzigen" reaches both chat participants live, same as messages/matches
-- (0001_init.sql). Guarded (unlike the plain `alter publication ... add
-- table` calls in 0001_init.sql, which only ever run once against a brand
-- new database) because this file is meant to be safe to re-run against an
-- existing database, and a second `add table` for the same table errors.
-- ─────────────────────────────────────────────────────────────────────────
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'trainings'
  ) then
    alter publication supabase_realtime add table public.trainings;
  end if;
end $$;

-- ─────────────────────────────────────────────────────────────────────────
-- Self-check: raises a specific error instead of an ambiguous "Success" -
-- same approach as 0022_posts_premium_only.sql and
-- 0023_discover_profiles_availability_filter.sql.
-- ─────────────────────────────────────────────────────────────────────────
do $$
begin
  if to_regclass('public.trainings') is null then
    raise exception 'public.trainings does not exist - did the CREATE TABLE above run?';
  end if;

  if not exists (select 1 from pg_proc where proname = 'has_elite_access' and pronamespace = 'public'::regnamespace) then
    raise exception 'has_elite_access() does not exist.';
  end if;

  if not exists (select 1 from pg_proc where proname = 'claim_training_reminders' and pronamespace = 'public'::regnamespace) then
    raise exception 'claim_training_reminders() does not exist.';
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'trainings'
      and policyname = 'Match participants can read trainings'
  ) then
    raise exception 'The SELECT policy on trainings is missing.';
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'trainings'
      and policyname = 'Elite match participants can propose trainings'
      and with_check ilike '%has_elite_access%'
  ) then
    raise exception 'The INSERT policy on trainings is missing, or no longer calls has_elite_access() - a non-Elite account would be able to create trainings.';
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'trainings'
      and policyname = 'Match participants can respond to trainings'
  ) then
    raise exception 'The UPDATE policy on trainings is missing.';
  end if;

  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'trainings'
  ) then
    raise exception 'public.trainings is not in the supabase_realtime publication - training cards would not update live for the other participant.';
  end if;

  if has_function_privilege('authenticated', 'public.claim_training_reminders(int)', 'execute') then
    raise exception 'authenticated can still execute claim_training_reminders() - Supabase''s project-wide default privileges grant EXECUTE on new public functions directly to authenticated (not via PUBLIC), so "revoke ... from public" alone never touches it. It must also be revoked from authenticated explicitly - see the comment above this function''s grant/revoke block.';
  end if;

  if has_function_privilege('anon', 'public.claim_training_reminders(int)', 'execute') then
    raise exception 'anon can still execute claim_training_reminders() - same cause/fix as the authenticated check above, just for the anon role.';
  end if;

  if not has_function_privilege('service_role', 'public.claim_training_reminders(int)', 'execute') then
    raise exception 'service_role cannot execute claim_training_reminders() - the reminder Edge Function would fail every time it runs.';
  end if;

  raise notice 'trainings table, has_elite_access(), claim_training_reminders(), all three RLS policies (select/Elite-only insert/update) and realtime are all correctly set up.';
end $$;
