-- Sportfrend initial schema
-- Run via `supabase db push` or paste into the Supabase SQL editor.

create extension if not exists "uuid-ossp";

-- ─────────────────────────────────────────────────────────────────────────
-- profiles: one row per auth.users user, holds all sportmaatje-matching data
-- ─────────────────────────────────────────────────────────────────────────
create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  full_name text,
  birthdate date,
  gender text check (gender in ('man', 'vrouw', 'anders')),
  bio text,
  sport text,
  level text check (level in ('beginner', 'gevorderd', 'competitief')),
  city text,
  latitude double precision,
  longitude double precision,
  search_radius_km integer default 25,
  avatar_url text,
  photo_url text,
  is_onboarded boolean default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ─────────────────────────────────────────────────────────────────────────
-- swipes: every like/skip a user performs on another profile
-- ─────────────────────────────────────────────────────────────────────────
create table if not exists public.swipes (
  id uuid primary key default uuid_generate_v4(),
  swiper_id uuid not null references public.profiles (id) on delete cascade,
  swiped_id uuid not null references public.profiles (id) on delete cascade,
  direction text not null check (direction in ('like', 'skip')),
  created_at timestamptz not null default now(),
  unique (swiper_id, swiped_id)
);

-- ─────────────────────────────────────────────────────────────────────────
-- matches: created when two profiles both swipe 'like' on each other
-- ─────────────────────────────────────────────────────────────────────────
create table if not exists public.matches (
  id uuid primary key default uuid_generate_v4(),
  user_a_id uuid not null references public.profiles (id) on delete cascade,
  user_b_id uuid not null references public.profiles (id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (user_a_id, user_b_id)
);

-- ─────────────────────────────────────────────────────────────────────────
-- messages: 1:1 chat messages that belong to a match
-- ─────────────────────────────────────────────────────────────────────────
create table if not exists public.messages (
  id uuid primary key default uuid_generate_v4(),
  match_id uuid not null references public.matches (id) on delete cascade,
  sender_id uuid not null references public.profiles (id) on delete cascade,
  body text not null,
  created_at timestamptz not null default now(),
  read_at timestamptz
);

-- ─────────────────────────────────────────────────────────────────────────
-- posts: "Bericht plaatsen" community feed items shown on the Berichten tab
-- ─────────────────────────────────────────────────────────────────────────
create table if not exists public.posts (
  id uuid primary key default uuid_generate_v4(),
  author_id uuid not null references public.profiles (id) on delete cascade,
  body text not null,
  image_url text,
  event_date date,
  created_at timestamptz not null default now()
);

create table if not exists public.post_likes (
  post_id uuid not null references public.posts (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (post_id, user_id)
);

-- ─────────────────────────────────────────────────────────────────────────
-- subscriptions: Basis / Premium / Elite plan per user
-- ─────────────────────────────────────────────────────────────────────────
create table if not exists public.subscriptions (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  plan text not null check (plan in ('basis', 'premium', 'elite')) default 'basis',
  status text not null check (status in ('active', 'canceled', 'past_due')) default 'active',
  price_cents integer not null default 0,
  current_period_end timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id)
);

-- ─────────────────────────────────────────────────────────────────────────
-- updated_at triggers
-- ─────────────────────────────────────────────────────────────────────────
create or replace function public.set_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists set_profiles_updated_at on public.profiles;
create trigger set_profiles_updated_at
  before update on public.profiles
  for each row execute function public.set_updated_at();

drop trigger if exists set_subscriptions_updated_at on public.subscriptions;
create trigger set_subscriptions_updated_at
  before update on public.subscriptions
  for each row execute function public.set_updated_at();

-- Auto-create a profile row whenever a new auth user signs up.
create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id) values (new.id)
  on conflict (id) do nothing;
  insert into public.subscriptions (user_id, plan) values (new.id, 'basis')
  on conflict (user_id) do nothing;
  return new;
end;
$$ language plpgsql security definer;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ─────────────────────────────────────────────────────────────────────────
-- Row Level Security
-- ─────────────────────────────────────────────────────────────────────────
alter table public.profiles enable row level security;
alter table public.swipes enable row level security;
alter table public.matches enable row level security;
alter table public.messages enable row level security;
alter table public.posts enable row level security;
alter table public.post_likes enable row level security;
alter table public.subscriptions enable row level security;

create policy "Profiles are readable by authenticated users"
  on public.profiles for select
  to authenticated
  using (true);

create policy "Users can update their own profile"
  on public.profiles for update
  to authenticated
  using (auth.uid() = id);

create policy "Users can insert their own profile"
  on public.profiles for insert
  to authenticated
  with check (auth.uid() = id);

create policy "Users manage their own swipes"
  on public.swipes for all
  to authenticated
  using (auth.uid() = swiper_id)
  with check (auth.uid() = swiper_id);

create policy "Users can view their own matches"
  on public.matches for select
  to authenticated
  using (auth.uid() = user_a_id or auth.uid() = user_b_id);

create policy "Matches are created by the matching function"
  on public.matches for insert
  to authenticated
  with check (auth.uid() = user_a_id or auth.uid() = user_b_id);

create policy "Match participants can read messages"
  on public.messages for select
  to authenticated
  using (
    exists (
      select 1 from public.matches m
      where m.id = match_id
        and (m.user_a_id = auth.uid() or m.user_b_id = auth.uid())
    )
  );

create policy "Match participants can send messages"
  on public.messages for insert
  to authenticated
  with check (
    sender_id = auth.uid()
    and exists (
      select 1 from public.matches m
      where m.id = match_id
        and (m.user_a_id = auth.uid() or m.user_b_id = auth.uid())
    )
  );

create policy "Posts are readable by authenticated users"
  on public.posts for select
  to authenticated
  using (true);

create policy "Users manage their own posts"
  on public.posts for insert
  to authenticated
  with check (auth.uid() = author_id);

create policy "Users can delete their own posts"
  on public.posts for delete
  to authenticated
  using (auth.uid() = author_id);

create policy "Likes are readable by authenticated users"
  on public.post_likes for select
  to authenticated
  using (true);

create policy "Users manage their own likes"
  on public.post_likes for all
  to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "Users can view their own subscription"
  on public.subscriptions for select
  to authenticated
  using (auth.uid() = user_id);

create policy "Users can update their own subscription"
  on public.subscriptions for update
  to authenticated
  using (auth.uid() = user_id);

-- ─────────────────────────────────────────────────────────────────────────
-- Realtime: broadcast changes on messages and matches for the chat screens
-- ─────────────────────────────────────────────────────────────────────────
alter publication supabase_realtime add table public.messages;
alter publication supabase_realtime add table public.matches;
alter publication supabase_realtime add table public.posts;
alter publication supabase_realtime add table public.post_likes;
