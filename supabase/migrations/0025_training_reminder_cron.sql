-- Schedules a periodic call (every 5 minutes) to the
-- send-training-reminder-push Edge Function via pg_cron + pg_net, so an
-- accepted training gets a push reminder ~2 hours before it starts
-- (requirement 5: "Hergebruik de bestaande pushmeldingen-infrastructuur").
--
-- This reuses the exact same webhook-secret mechanism as
-- 0011_push_notifications.sql (DB_WEBHOOK_SECRET / the x-webhook-secret
-- header, verified by verifyWebhookSecret() in supabase/functions/_shared/push.ts)
-- and the same createServiceRoleClient()/sendExpoPushNotifications()/
-- jsonResponse() helpers as send-message-push and send-match-push. The one
-- real difference from those two: this is *time-based* (pg_cron polling),
-- not *event-based* (an INSERT trigger) - "2 hours before a training
-- starts" isn't a database row-change event any trigger could fire on, so
-- there's nothing to attach a `supabase_functions.http_request` trigger
-- to the way 0011 does for new messages/matches. pg_cron + pg_net's
-- net.http_post is the standard Supabase equivalent for "call this Edge
-- Function on a schedule" instead of "call it on a row event".
--
-- BEFORE RUNNING THIS FILE:
--   1. Run 0024_trainings_planner.sql first if you haven't already.
--   2. Deploy the Edge Function:
--        supabase functions deploy send-training-reminder-push --no-verify-jwt
--   3. Enable the pg_cron and pg_net extensions for this project: Database
--      -> Extensions in the Supabase dashboard (search "pg_cron" and
--      "pg_net", toggle both on). On hosted Supabase this dashboard toggle
--      is the supported way to enable them - `create extension` for these
--      two usually needs privileges a project's own Postgres role doesn't
--      have.
--   4. Make sure DB_WEBHOOK_SECRET is already set - this reuses the exact
--      same secret as 0011_push_notifications.sql, nothing new to
--      generate: `supabase secrets set DB_WEBHOOK_SECRET=...` if you
--      haven't already.
--   5. Replace REPLACE_WITH_YOUR_DB_WEBHOOK_SECRET below with that same
--      value (same caveat as 0011: this file is committed to the repo -
--      fill in your own copy locally, don't commit the real value back).
--      Leave duefdlibkeghdskongjd (the Supabase project ref) as-is.
--
-- Run this via `supabase db push` or paste into the Supabase SQL editor
-- (after editing the placeholder above and enabling the two extensions).
-- Safe to run more than once - cron.schedule() with a job name that
-- already exists replaces that job's definition instead of duplicating it.

select cron.schedule(
  'training-reminder-push',
  '*/5 * * * *',
  $$
  select net.http_post(
    url := 'https://duefdlibkeghdskongjd.supabase.co/functions/v1/send-training-reminder-push',
    headers := jsonb_build_object('Content-Type', 'application/json', 'x-webhook-secret', 'REPLACE_WITH_YOUR_DB_WEBHOOK_SECRET'),
    body := '{}'::jsonb
  );
  $$
);

-- ─────────────────────────────────────────────────────────────────────────
-- Verify after applying:
-- ─────────────────────────────────────────────────────────────────────────
-- select jobname, schedule, active from cron.job where jobname = 'training-reminder-push';
-- -- expect: one row, schedule = '*/5 * * * *', active = true

-- ─────────────────────────────────────────────────────────────────────────
-- Self-check: same "raise a specific EXCEPTION instead of an ambiguous
-- Success" approach as 0024_trainings_planner.sql - if pg_cron isn't
-- enabled yet, the `select cron.schedule(...)` above already fails hard
-- with "schemacron does not exist", so this mainly confirms the job's
-- schedule/active flag actually came out as expected.
-- ─────────────────────────────────────────────────────────────────────────
do $$
declare
  v_schedule text;
  v_active boolean;
begin
  select schedule, active into v_schedule, v_active
  from cron.job where jobname = 'training-reminder-push';

  if v_schedule is null then
    raise exception 'cron.job "training-reminder-push" was not created.';
  end if;

  if v_schedule <> '*/5 * * * *' then
    raise exception 'cron.job "training-reminder-push" has schedule %, expected */5 * * * *.', v_schedule;
  end if;

  if not v_active then
    raise exception 'cron.job "training-reminder-push" exists but is not active.';
  end if;

  raise notice 'training-reminder-push cron job is scheduled every 5 minutes and active.';
end $$;
