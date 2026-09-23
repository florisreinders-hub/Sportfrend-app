-- RevenueCat is now the source of truth for public.subscriptions
-- (supabase/functions/revenuecat-webhook, running server-side with the
-- service-role key - see README.md's "RevenueCat" section for the full
-- write-up). Revokes the client's own INSERT/UPDATE on this table
-- (0001_init.sql / 0007_subscriptions_insert_policy.sql originally granted
-- `auth.uid() = user_id`, which the app's sandbox purchase flow used to
-- self-grant a plan) - a client could otherwise set its own plan to
-- 'elite' directly, without ever paying, since RLS only checked "is this
-- your own row", never "did you actually pay for this". SELECT stays
-- (fetchSubscription() in lib/api.ts, used by "Mijn gegevens opvragen").
--
-- Run this via `supabase db push` or paste into the Supabase SQL editor.
-- Safe to run more than once.

drop policy if exists "Users can insert their own subscription" on public.subscriptions;
drop policy if exists "Users can update their own subscription" on public.subscriptions;

-- ─────────────────────────────────────────────────────────────────────────
-- Verify na het draaien:
-- ─────────────────────────────────────────────────────────────────────────
-- select policyname, cmd from pg_policies where schemaname = 'public' and tablename = 'subscriptions' order by policyname;
-- -- verwacht: alleen "Users can view their own subscription" (cmd = 'SELECT') - geen INSERT/UPDATE-policy meer.
-- ─────────────────────────────────────────────────────────────────────────

do $$
begin
  if exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'subscriptions' and cmd in ('INSERT', 'UPDATE')
  ) then
    raise exception 'subscriptions heeft nog een INSERT/UPDATE-policy voor authenticated - deze had verwijderd moeten zijn.';
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'subscriptions' and policyname = 'Users can view their own subscription'
  ) then
    raise exception '"Users can view their own subscription"-policy op subscriptions ontbreekt - die had wel moeten blijven staan.';
  end if;

  raise notice 'subscriptions is nu read-only voor authenticated (alleen SELECT op eigen rij) - alleen de service-role (revenuecat-webhook) mag nog schrijven.';
end $$;
