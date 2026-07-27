-- Backs the "Instellingen" screen's notificatie-voorkeuren,
-- privacy-instellingen, and per-dag beschikbaarheid - previously only
-- local, unpersisted UI state (or, for beschikbaarheid, not built at all -
-- it was explicitly deferred from the Filter screen to "je
-- profielinstellingen" a few turns ago).
--
-- Run this via `supabase db push` or paste into the Supabase SQL editor.
-- Safe to run more than once.

alter table public.profiles add column if not exists push_notifications_enabled boolean not null default true;
alter table public.profiles add column if not exists profile_visible boolean not null default true;
alter table public.profiles add column if not exists availability_days text[] not null default '{}';
