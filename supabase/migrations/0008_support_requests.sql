-- Backs the "Klantenservice" screen's contact form (app/settings/
-- SupportScreen.tsx), which previously just flipped local UI state on
-- "Versturen" without saving the message anywhere - not a working
-- feature, just a form that silently discarded whatever was typed into
-- it.
--
-- Run this via `supabase db push` or paste into the Supabase SQL editor.
-- Safe to run more than once.

create table if not exists public.support_requests (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  subject text not null,
  message text not null,
  created_at timestamptz not null default now()
);

alter table public.support_requests enable row level security;

drop policy if exists "Users can insert their own support requests" on public.support_requests;
create policy "Users can insert their own support requests"
  on public.support_requests for insert
  to authenticated
  with check (auth.uid() = user_id);

drop policy if exists "Users can view their own support requests" on public.support_requests;
create policy "Users can view their own support requests"
  on public.support_requests for select
  to authenticated
  using (auth.uid() = user_id);
