-- Moderation: "reports" (Rapporteren) and "blocks" (Blokkeren) tables, plus
-- the RLS changes on profiles/matches/messages that make a block actually
-- take effect - hides both users from each other in Ontdekken, hides any
-- existing match (and with it, its messages), and blocks new messages
-- between them as a defense-in-depth on top of the hidden match.
--
-- Run this via `supabase db push` or paste into the Supabase SQL editor.
-- Safe to run more than once. 0001_init.sql has been updated to match for
-- fresh installs - this file is for databases that already existed before
-- that update.

-- ─────────────────────────────────────────────────────────────────────────
-- Tables
-- ─────────────────────────────────────────────────────────────────────────
create table if not exists public.reports (
  id uuid primary key default uuid_generate_v4(),
  reporter_id uuid not null references public.profiles (id) on delete cascade,
  reported_id uuid not null references public.profiles (id) on delete cascade,
  reason text not null,
  details text,
  match_id uuid references public.matches (id) on delete set null,
  status text not null default 'open' check (status in ('open', 'reviewing', 'resolved', 'dismissed')),
  created_at timestamptz not null default now()
);

create table if not exists public.blocks (
  id uuid primary key default uuid_generate_v4(),
  blocker_id uuid not null references public.profiles (id) on delete cascade,
  blocked_id uuid not null references public.profiles (id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (blocker_id, blocked_id)
);

alter table public.reports enable row level security;
alter table public.blocks enable row level security;

-- ─────────────────────────────────────────────────────────────────────────
-- reports / blocks RLS: users only see/create their own
-- ─────────────────────────────────────────────────────────────────────────
drop policy if exists "Users can create their own reports" on public.reports;
create policy "Users can create their own reports"
  on public.reports for insert
  to authenticated
  with check (auth.uid() = reporter_id);

drop policy if exists "Users can view their own reports" on public.reports;
create policy "Users can view their own reports"
  on public.reports for select
  to authenticated
  using (auth.uid() = reporter_id);

drop policy if exists "Users can create their own blocks" on public.blocks;
create policy "Users can create their own blocks"
  on public.blocks for insert
  to authenticated
  with check (auth.uid() = blocker_id);

drop policy if exists "Users can view their own blocks" on public.blocks;
create policy "Users can view their own blocks"
  on public.blocks for select
  to authenticated
  using (auth.uid() = blocker_id);

drop policy if exists "Users can remove their own blocks" on public.blocks;
create policy "Users can remove their own blocks"
  on public.blocks for delete
  to authenticated
  using (auth.uid() = blocker_id);

-- ─────────────────────────────────────────────────────────────────────────
-- profiles: blocked users no longer see each other's profile at all - this
-- alone hides them from each other in Ontdekken (fetchDiscoverProfiles
-- selects from profiles) and gracefully degrades any leftover embed
-- elsewhere (e.g. a post's author) via the app's existing "Sportmaatje"
-- fallback, with no client code changes needed. A user can always still
-- read their own row.
-- ─────────────────────────────────────────────────────────────────────────
drop policy if exists "Profiles are readable by authenticated users" on public.profiles;
create policy "Profiles are readable by authenticated users"
  on public.profiles for select
  to authenticated
  using (
    auth.uid() = id
    or not exists (
      select 1 from public.blocks b
      where (b.blocker_id = auth.uid() and b.blocked_id = profiles.id)
         or (b.blocker_id = profiles.id and b.blocked_id = auth.uid())
    )
  );

-- ─────────────────────────────────────────────────────────────────────────
-- matches: a blocked match is hidden from both participants. Since
-- "Match participants can read messages" re-checks this same matches row
-- via its own EXISTS subquery (and that subquery is itself subject to this
-- policy, for the same querying role), hiding the match also hides its
-- messages - no separate change needed for message *reads*.
-- ─────────────────────────────────────────────────────────────────────────
drop policy if exists "Users can view their own matches" on public.matches;
create policy "Users can view their own matches"
  on public.matches for select
  to authenticated
  using (
    (auth.uid() = user_a_id or auth.uid() = user_b_id)
    and not exists (
      select 1 from public.blocks b
      where (b.blocker_id = matches.user_a_id and b.blocked_id = matches.user_b_id)
         or (b.blocker_id = matches.user_b_id and b.blocked_id = matches.user_a_id)
    )
  );

-- ─────────────────────────────────────────────────────────────────────────
-- messages: defense-in-depth - explicitly block new messages between two
-- blocked users, rather than relying solely on the match being hidden.
-- ─────────────────────────────────────────────────────────────────────────
drop policy if exists "Match participants can send messages" on public.messages;
create policy "Match participants can send messages"
  on public.messages for insert
  to authenticated
  with check (
    sender_id = auth.uid()
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
