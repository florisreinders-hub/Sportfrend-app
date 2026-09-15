-- Rate limiting on two previously-unlimited write paths, both flagged in
-- the pre-launch technical review: an account could submit unlimited
-- moderation reports (harassment vector: flood someone with false
-- reports) and unlimited Klantenservice-aanvragen (each one triggers a
-- real outbound e-mail via Resend - send-support-email - so unlimited
-- submissions cost real money/API quota, not just annoyance).
--
-- Same pattern as messages_plan_daily_limit()/can_send_message_today()/
-- messages_daily_status() (0020_messages_daily_limit.sql) - the one
-- difference: these two limits are flat, not plan-dependent. False
-- reports and support spam are pure abuse-prevention, not a paid-tier
-- perk to withhold from Basis, so there's no "_plan_" lookup function
-- here, just a constant.
--
-- Run this via `supabase db push` or paste into the Supabase SQL editor.
-- Safe to run more than once (every function is `create or replace`, and
-- both policies are dropped and recreated).
--
-- ─────────────────────────────────────────────────────────────────────────
-- Verify after applying:
-- ─────────────────────────────────────────────────────────────────────────
-- select
--   (select count(*) from pg_proc where proname = 'can_submit_report_today'
--      and pronamespace = 'public'::regnamespace) as has_report_check_fn,
--   (select count(*) from pg_proc where proname = 'reports_daily_status'
--      and pronamespace = 'public'::regnamespace) as has_report_status_fn,
--   (select count(*) from pg_proc where proname = 'can_submit_support_request_today'
--      and pronamespace = 'public'::regnamespace) as has_support_check_fn,
--   (select count(*) from pg_proc where proname = 'support_requests_daily_status'
--      and pronamespace = 'public'::regnamespace) as has_support_status_fn,
--   (select count(*) from pg_policies where schemaname = 'public' and tablename = 'reports'
--      and policyname = 'Users can create their own reports'
--      and with_check ilike '%can_submit_report_today%') as reports_insert_policy_gated,
--   (select count(*) from pg_policies where schemaname = 'public' and tablename = 'support_requests'
--      and policyname = 'Users can insert their own support requests'
--      and with_check ilike '%can_submit_support_request_today%') as support_insert_policy_gated,
--   public.reports_daily_limit() as reports_daily_limit,
--   public.support_requests_daily_limit() as support_requests_daily_limit;
-- -- expect: 1, 1, 1, 1, 1, 1, 10, 5

-- reports_daily_limit: single source of truth for the flat daily cap on
-- moderation reports (not plan-dependent, see file header).
create or replace function public.reports_daily_limit()
returns int
language sql
immutable
as $$
  select 10;
$$;

-- can_submit_report_today: the actual enforcement, used in the INSERT
-- policy below. SECURITY DEFINER + auth.uid()-scoped, same reasoning as
-- can_send_message_today() - only ever answers "can I report someone
-- today", never checks someone else's quota.
create or replace function public.can_submit_report_today()
returns boolean
language plpgsql
security definer
set search_path = public
stable
as $$
declare
  v_uid uuid := auth.uid();
  v_used_today int;
begin
  if v_uid is null then
    return false;
  end if;

  select count(*) into v_used_today
  from public.reports r
  where r.reporter_id = v_uid and r.created_at::date = current_date;

  return v_used_today < public.reports_daily_limit();
end;
$$;

-- reports_daily_status: lets ReportModal show a clear "dagelijkse limiet
-- bereikt" message instead of a bare RLS-violation error, which is
-- client-side indistinguishable from any other "not allowed" failure.
-- Same shape/reasoning as messages_daily_status() - no `plan` column
-- here since this limit isn't plan-dependent.
create or replace function public.reports_daily_status()
returns table (daily_limit int, used_today int, remaining int)
language plpgsql
security definer
set search_path = public
stable
as $$
declare
  v_uid uuid := auth.uid();
  v_daily_limit int := public.reports_daily_limit();
  v_used_today int;
begin
  if v_uid is null then
    raise exception 'Not authenticated';
  end if;

  select count(*) into v_used_today
  from public.reports r
  where r.reporter_id = v_uid and r.created_at::date = current_date;

  return query select v_daily_limit, v_used_today, greatest(v_daily_limit - v_used_today, 0);
end;
$$;

grant execute on function public.reports_daily_limit() to authenticated;
grant execute on function public.can_submit_report_today() to authenticated;
grant execute on function public.reports_daily_status() to authenticated;

drop policy if exists "Users can create their own reports" on public.reports;
create policy "Users can create their own reports"
  on public.reports for insert
  to authenticated
  with check (auth.uid() = reporter_id and public.can_submit_report_today());

-- support_requests_daily_limit: single source of truth for the flat daily
-- cap on Klantenservice-aanvragen (also flat, not plan-dependent - every
-- plan gets the same support access, this purely guards Resend spend/quota).
create or replace function public.support_requests_daily_limit()
returns int
language sql
immutable
as $$
  select 5;
$$;

-- can_submit_support_request_today: same shape as can_submit_report_today().
create or replace function public.can_submit_support_request_today()
returns boolean
language plpgsql
security definer
set search_path = public
stable
as $$
declare
  v_uid uuid := auth.uid();
  v_used_today int;
begin
  if v_uid is null then
    return false;
  end if;

  select count(*) into v_used_today
  from public.support_requests sr
  where sr.user_id = v_uid and sr.created_at::date = current_date;

  return v_used_today < public.support_requests_daily_limit();
end;
$$;

-- support_requests_daily_status: same shape/reasoning as
-- reports_daily_status() above. Note this only guards the
-- public.support_requests row (the actual record/source of truth) - it
-- has no way to separately rate-limit the send-support-email Edge
-- Function call SupportScreen.tsx makes right after
-- (notifySupportRequest()), but that call only ever happens once per
-- successful support_requests insert in this app's own client, so
-- capping the insert already caps the e-mail volume in practice. A
-- hand-crafted client could still call the Edge Function directly without
-- ever inserting a row - see this migration's own note further down on
-- why that's accepted as a smaller residual risk here, not closed off.
create or replace function public.support_requests_daily_status()
returns table (daily_limit int, used_today int, remaining int)
language plpgsql
security definer
set search_path = public
stable
as $$
declare
  v_uid uuid := auth.uid();
  v_daily_limit int := public.support_requests_daily_limit();
  v_used_today int;
begin
  if v_uid is null then
    raise exception 'Not authenticated';
  end if;

  select count(*) into v_used_today
  from public.support_requests sr
  where sr.user_id = v_uid and sr.created_at::date = current_date;

  return query select v_daily_limit, v_used_today, greatest(v_daily_limit - v_used_today, 0);
end;
$$;

grant execute on function public.support_requests_daily_limit() to authenticated;
grant execute on function public.can_submit_support_request_today() to authenticated;
grant execute on function public.support_requests_daily_status() to authenticated;

drop policy if exists "Users can insert their own support requests" on public.support_requests;
create policy "Users can insert their own support requests"
  on public.support_requests for insert
  to authenticated
  with check (auth.uid() = user_id and public.can_submit_support_request_today());

-- ─────────────────────────────────────────────────────────────────────────
-- Self-check: raises a specific error instead of an ambiguous "Success" -
-- same approach as 0022/0023/0024.
-- ─────────────────────────────────────────────────────────────────────────
do $$
begin
  if not exists (select 1 from pg_proc where proname = 'can_submit_report_today' and pronamespace = 'public'::regnamespace) then
    raise exception 'can_submit_report_today() does not exist.';
  end if;

  if not exists (select 1 from pg_proc where proname = 'reports_daily_status' and pronamespace = 'public'::regnamespace) then
    raise exception 'reports_daily_status() does not exist.';
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'reports'
      and policyname = 'Users can create their own reports'
      and with_check ilike '%can_submit_report_today%'
  ) then
    raise exception 'The INSERT policy on reports is missing, or no longer calls can_submit_report_today() - reports would be unlimited again.';
  end if;

  if public.reports_daily_limit() <> 10 then
    raise exception 'reports_daily_limit() returns % instead of the expected 10.', public.reports_daily_limit();
  end if;

  if not exists (select 1 from pg_proc where proname = 'can_submit_support_request_today' and pronamespace = 'public'::regnamespace) then
    raise exception 'can_submit_support_request_today() does not exist.';
  end if;

  if not exists (select 1 from pg_proc where proname = 'support_requests_daily_status' and pronamespace = 'public'::regnamespace) then
    raise exception 'support_requests_daily_status() does not exist.';
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'support_requests'
      and policyname = 'Users can insert their own support requests'
      and with_check ilike '%can_submit_support_request_today%'
  ) then
    raise exception 'The INSERT policy on support_requests is missing, or no longer calls can_submit_support_request_today() - support spam would be unlimited again.';
  end if;

  if public.support_requests_daily_limit() <> 5 then
    raise exception 'support_requests_daily_limit() returns % instead of the expected 5.', public.support_requests_daily_limit();
  end if;

  raise notice 'reports and support_requests daily limits (10/dag en 5/dag) are correctly wired up: check functions, status functions, and both INSERT policies all in place.';
end $$;
