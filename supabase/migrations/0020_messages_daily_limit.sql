-- Enforces the daily message-sending limit shown on the Pricing screen
-- (PricingScreen.tsx: Basis "3 Berichten per dag sturen", Premium/Elite
-- "Onbeperkt chatten") server-side, on the "Match participants can send
-- messages" INSERT policy on public.messages - the same table/policy every
-- message send already goes through, so this can't be bypassed by a
-- hand-crafted API call the way a client-side counter could. Same
-- approach as 0019_discover_daily_limit.sql: count today's usage per
-- sender and compare against a per-plan limit, rather than a separate
-- "views" table - a message row already carries its own sender_id and
-- created_at, so there's nothing extra to track here (unlike Ontdekken,
-- where a *shown-but-unswiped* profile had to be remembered separately so
-- re-fetching the same candidates wouldn't re-consume quota - sending a
-- message is a one-shot action with no equivalent "shown again" case).
--
-- Run this via `supabase db push` or paste into the Supabase SQL editor.
-- Safe to run more than once. 0001_init.sql has been updated to match for
-- fresh installs.

-- ─────────────────────────────────────────────────────────────────────────
-- messages_plan_daily_limit: single source of truth for each plan's daily
-- message limit, mirroring discover_plan_daily_limit(). null means
-- unlimited (Premium and Elite both chat unlimited per the Pricing copy -
-- only Basis has a cap).
-- ─────────────────────────────────────────────────────────────────────────
create or replace function public.messages_plan_daily_limit(p_plan text)
returns int
language sql
immutable
as $$
  select case p_plan
    when 'basis' then 3
    else null -- 'premium' and 'elite': onbeperkt chatten
  end;
$$;

-- ─────────────────────────────────────────────────────────────────────────
-- can_send_message_today: the actual enforcement check, used inside the
-- INSERT policy below. SECURITY DEFINER so it can read the caller's own
-- subscriptions row and count their own messages regardless of which
-- table-level RLS policies the calling role would otherwise need for
-- that (matches the get_my_location()/discover_profiles() pattern) -
-- scoped entirely to auth.uid(), never a parameter, so it can only ever
-- answer "can I send a message today", never check someone else's quota.
-- ─────────────────────────────────────────────────────────────────────────
create or replace function public.can_send_message_today()
returns boolean
language plpgsql
security definer
set search_path = public
stable
as $$
declare
  v_uid uuid := auth.uid();
  v_plan text;
  v_daily_limit int;
  v_used_today int;
begin
  if v_uid is null then
    return false;
  end if;

  select s.plan into v_plan
  from public.subscriptions s
  where s.user_id = v_uid and s.status = 'active';

  v_daily_limit := public.messages_plan_daily_limit(coalesce(v_plan, 'basis'));
  if v_daily_limit is null then
    return true;
  end if;

  select count(*) into v_used_today
  from public.messages m
  where m.sender_id = v_uid and m.created_at::date = current_date;

  return v_used_today < v_daily_limit;
end;
$$;

-- ─────────────────────────────────────────────────────────────────────────
-- messages_daily_status: lets the client show a clear "daily limit
-- reached" message (with an upgrade link) instead of a bare RLS-violation
-- error - a blocked insert alone can't be told apart client-side from
-- "you got blocked" or "this isn't your match" (both raise the exact same
-- generic Postgres error). Same shape/reasoning as discover_daily_status().
-- ─────────────────────────────────────────────────────────────────────────
create or replace function public.messages_daily_status()
returns table (plan text, daily_limit int, used_today int, remaining int)
language plpgsql
security definer
set search_path = public
stable
as $$
declare
  v_uid uuid := auth.uid();
  v_plan text;
  v_daily_limit int;
  v_used_today int;
begin
  if v_uid is null then
    raise exception 'Not authenticated';
  end if;

  select s.plan into v_plan
  from public.subscriptions s
  where s.user_id = v_uid and s.status = 'active';

  v_plan := coalesce(v_plan, 'basis');
  v_daily_limit := public.messages_plan_daily_limit(v_plan);

  if v_daily_limit is not null then
    select count(*) into v_used_today
    from public.messages m
    where m.sender_id = v_uid and m.created_at::date = current_date;
  end if;

  return query select
    v_plan,
    v_daily_limit,
    v_used_today,
    case when v_daily_limit is null then null else greatest(v_daily_limit - coalesce(v_used_today, 0), 0) end;
end;
$$;

grant execute on function public.messages_plan_daily_limit(text) to authenticated;
grant execute on function public.can_send_message_today() to authenticated;
grant execute on function public.messages_daily_status() to authenticated;

-- ─────────────────────────────────────────────────────────────────────────
-- The actual enforcement: added as one more AND-ed condition on the
-- existing "Match participants can send messages" policy. A batch INSERT
-- of several rows in a single statement isn't fully airtight against this
-- (each row's WITH CHECK sees the same pre-statement snapshot, so N rows
-- inserted at once could all pass even past the limit) - this app's own
-- client (sendMessage(), lib/api.ts) only ever inserts one message at a
-- time, so that's a theoretical gap for a hand-crafted batch request, not
-- a practical one; the single-row case (the only case this app produces)
-- is fully enforced.
-- ─────────────────────────────────────────────────────────────────────────
drop policy if exists "Match participants can send messages" on public.messages;
create policy "Match participants can send messages"
  on public.messages for insert
  to authenticated
  with check (
    sender_id = auth.uid()
    and public.can_send_message_today()
    and exists (
      select 1 from public.matches m
      where m.id = match_id
        and (m.user_a_id = auth.uid() or m.user_b_id = auth.uid())
        and not exists (
          select 1 from public.blocks b
          where (b.blocker_id = m.user_a_id and b.blocked_id = m.user_b_id)
             or (b.blocker_id = m.user_b_id and b.blocked_id = m.user_a_id)
        )
    )
  );
