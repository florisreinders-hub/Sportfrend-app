-- Push notifications: adds profiles.expo_push_token, then wires up two
-- database webhooks (Supabase's `supabase_functions.http_request` trigger
-- function - the same mechanism the dashboard's Database Webhooks UI
-- creates under the hood) that call the send-message-push and
-- send-match-push Edge Functions whenever a row is inserted into
-- public.messages / public.matches.
--
-- BEFORE RUNNING THIS FILE:
--   1. Deploy both Edge Functions (see README.md's "Pushmeldingen"
--      section for the full step-by-step).
--   2. Generate a random secret and set it on the project:
--        openssl rand -hex 32
--        supabase secrets set DB_WEBHOOK_SECRET=<the value you generated>
--   3. Replace every duefdlibkeghdskongjd below with that
--      *same* value (this file is committed to the repo, so this
--      placeholder is deliberately not a real secret - fill in your own
--      copy before running it, don't commit the real value back).
--
-- Run this via `supabase db push` or paste into the Supabase SQL editor
-- (after editing the placeholder above). Safe to run more than once.

alter table public.profiles add column if not exists expo_push_token text;

drop trigger if exists send_message_push_notification on public.messages;
create trigger send_message_push_notification
  after insert on public.messages
  for each row
  execute function supabase_functions.http_request(
    'https://duefdlibkeghdskongjd.supabase.co/functions/v1/send-message-push',
    'POST',
    '{"Content-type":"application/json","x-webhook-secret":"REPLACE_WITH_YOUR_DB_WEBHOOK_SECRET"}',
    '{}',
    '5000'
  );

drop trigger if exists send_match_push_notification on public.matches;
create trigger send_match_push_notification
  after insert on public.matches
  for each row
  execute function supabase_functions.http_request(
    'https://duefdlibkeghdskongjd.supabase.co/functions/v1/send-match-push',
    'POST',
    '{"Content-type":"application/json","x-webhook-secret":"REPLACE_WITH_YOUR_DB_WEBHOOK_SECRET"}',
    '{}',
    '5000'
  );

-- If your Supabase project doesn't have supabase_functions.http_request
-- available (older/self-hosted projects sometimes don't), skip the two
-- triggers above and instead create the same two webhooks via the
-- dashboard: Database -> Webhooks -> Create a new webhook, pointing each
-- at the same function URLs and header above - that UI creates an
-- equivalent trigger for you.
