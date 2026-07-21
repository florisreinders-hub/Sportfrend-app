-- Adds 'pending' as an allowed public.subscriptions.status value, for the
-- Pricing screen's "Kies" action: selecting Premium/Elite saves that
-- choice ahead of the payment flow, without it being mistaken for a
-- completed (even demo) payment - which is what the existing 'active'
-- status is reserved for once PaymentScreen's checkout actually runs.
--
-- Postgres doesn't support altering a check constraint in place - drop and
-- recreate it. subscriptions_status_check is the name Postgres
-- auto-generated for the inline `check (status in (...))` clause in
-- 0001_init.sql (no explicit `constraint` name given there).
--
-- Run this via `supabase db push` or paste into the Supabase SQL editor.
-- Safe to run more than once.

alter table public.subscriptions drop constraint if exists subscriptions_status_check;
alter table public.subscriptions add constraint subscriptions_status_check
  check (status in ('pending', 'active', 'canceled', 'past_due'));
