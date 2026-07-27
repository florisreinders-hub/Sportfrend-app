-- Patches an existing public.posts table (created before the "Bericht
-- plaatsen" screen's sport/datum-tijd/locatie fields were added to
-- 0001_init.sql) with the columns it's currently missing.
--
-- Run this via `supabase db push` or paste into the Supabase SQL editor.
-- Safe to run more than once - every statement is a no-op if already applied.

alter table public.posts add column if not exists sport text;
alter table public.posts add column if not exists event_time text;
alter table public.posts add column if not exists location text;
