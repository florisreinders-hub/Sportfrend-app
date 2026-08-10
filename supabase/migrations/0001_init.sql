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
  level text check (level in ('beginner', 'gemiddeld', 'gevorderd', 'expert')),
  city text,
  latitude double precision,
  longitude double precision,
  search_radius_km integer default 25,
  avatar_url text,
  photo_url text,
  is_onboarded boolean default false,
  push_notifications_enabled boolean not null default true,
  profile_visible boolean not null default true,
  availability_days text[] not null default '{}',
  expo_push_token text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Note: if public.profiles already existed in your database from before
-- the three columns above were added to this file, the `create table if
-- not exists` above is a no-op and won't add them - run
-- supabase/migrations/0005_profile_settings.sql to patch those.
--
-- Similarly, the level check constraint above (an inline `create table`
-- constraint, applied only when the table is first created) won't update
-- an existing table's constraint either - run
-- supabase/migrations/0010_profiles_level_gemiddeld.sql to add 'gemiddeld'
-- and rename 'competitief' to 'expert' on an existing database.
--
-- And expo_push_token (for push notifications) needs
-- supabase/migrations/0011_push_notifications.sql on an existing database
-- for the same reason - that file also sets up the database webhooks that
-- actually send the notifications, which 0001 intentionally does not
-- (they embed a project-specific secret, see that file's own comments).

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
  sport text,
  event_date date,
  event_time text,
  location text,
  created_at timestamptz not null default now()
);

-- Note: if public.posts already existed in your database from before the
-- sport/event_time/location columns above were added to this file, the
-- `create table if not exists` above is a no-op and won't add them. The
-- app itself only writes to sport and event_date - run
-- supabase/migrations/0004_posts_sport_column_fix.sql to patch those (it
-- repeats what 0002/0003 already added, if those never actually got run).

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
  -- 'pending' = chosen on the Pricing screen, checkout not completed yet -
  -- distinct from 'active' so a plan selection is never mistaken for a
  -- real (even demo) payment. See supabase/migrations/0006_subscriptions_pending_status.sql.
  status text not null check (status in ('pending', 'active', 'canceled', 'past_due')) default 'active',
  price_cents integer not null default 0,
  current_period_end timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id)
);

-- ─────────────────────────────────────────────────────────────────────────
-- reports / blocks: moderation (see supabase/migrations/0012_moderation_reports_blocks.sql
-- for the full standalone migration, incl. the RLS changes on profiles/
-- matches/messages that make blocking actually take effect - not repeated
-- inline here since those are `alter policy`/`drop + create` statements
-- against policies defined further down this same file)
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

-- ─────────────────────────────────────────────────────────────────────────
-- support_requests: "Klantenservice" contact form submissions
-- ─────────────────────────────────────────────────────────────────────────
create table if not exists public.support_requests (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  subject text not null,
  message text not null,
  created_at timestamptz not null default now()
);

-- Note: if public.support_requests already existed in your database from
-- before this table was added to this file, `create table if not exists`
-- above is a no-op - run supabase/migrations/0008_support_requests.sql.

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
alter table public.support_requests enable row level security;
alter table public.reports enable row level security;
alter table public.blocks enable row level security;

-- expo_push_token is write-only from the client's point of view (only
-- lib/notifications.ts upserts it; nothing in the app UI reads it back,
-- own or anyone else's - only the send-message-push/send-match-push Edge
-- Functions read it, via the service-role key, which isn't subject to
-- this grant). Table-level SELECT on public.profiles otherwise defaults
-- to all columns, which would let any authenticated user read anyone
-- else's push token - and since Expo's push API accepts a bare token with
-- no further authentication, that token alone is enough to send that
-- person arbitrary spoofed push notifications. Every profiles query in
-- the app uses lib/api.ts's PROFILE_COLUMNS (or a subset) instead of "*"
-- to match this.
-- latitude/longitude are excluded here too (see
-- 0014_discover_profiles_location_privacy.sql) - exact GPS coordinates are
-- no longer readable by anyone, including the owner, via a plain column
-- read. The owner reads their own via get_my_location(); everyone else
-- only ever gets a computed distance via discover_profiles() - both
-- defined further down this file, after the storage section.
revoke select on public.profiles from authenticated;
grant select (
  id, full_name, birthdate, gender, bio, sport, level, city,
  search_radius_km, avatar_url, photo_url, is_onboarded, push_notifications_enabled,
  profile_visible, availability_days, created_at, updated_at
) on public.profiles to authenticated;

-- Blocked users are hidden from each other everywhere profiles are read
-- (Ontdekken, connecties, posts' author embed, ...) except a user can
-- always read their own row. Beyond blocking, a profile with
-- profile_visible = false (the "Profiel zichtbaar voor anderen" toggle in
-- Instellingen) is only readable by its owner and by users who already
-- have a match with them - the toggle is meant to control discoverability
-- by strangers, not to hide someone from a match they're already chatting
-- with.
create policy "Profiles are readable by authenticated users"
  on public.profiles for select
  to authenticated
  using (
    auth.uid() = id
    or (
      not exists (
        select 1 from public.blocks b
        where (b.blocker_id = auth.uid() and b.blocked_id = profiles.id)
           or (b.blocker_id = profiles.id and b.blocked_id = auth.uid())
      )
      and (
        profiles.profile_visible = true
        or exists (
          select 1 from public.matches m
          where (m.user_a_id = auth.uid() and m.user_b_id = profiles.id)
             or (m.user_b_id = auth.uid() and m.user_a_id = profiles.id)
        )
      )
    )
  );

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

-- recordSwipe() (lib/api.ts) needs to read the *other* person's swipe row
-- to detect a mutual like (their swiper_id is not auth.uid(), so the
-- policy above alone hides it) - without this, two people liking each
-- other would never actually produce a match, since neither session could
-- ever see the other's row. Scoped to only the 'like' direction so a user
-- still can't see who skipped them.
create policy "Users can see likes directed at them"
  on public.swipes for select
  to authenticated
  using (auth.uid() = swiped_id and direction = 'like');

-- A blocked match is hidden from both participants - this also hides its
-- messages, since "Match participants can read messages" below re-checks
-- this same matches row (itself subject to this policy) via its EXISTS
-- subquery.
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

-- Without the two "exists" checks, any authenticated user could insert an
-- arbitrary matches row naming themselves and any other profile as long as
-- they pass themselves as user_a_id/user_b_id - forcing a "match" (and
-- therefore the ability to message) with someone who never actually liked
-- them back. Requiring both directions of a 'like' swipe to already exist
-- makes the double opt-in a database-enforced rule, not just something the
-- client (recordSwipe in lib/api.ts) happens to do voluntarily.
create policy "Matches are created by the matching function"
  on public.matches for insert
  to authenticated
  with check (
    (auth.uid() = user_a_id or auth.uid() = user_b_id)
    and exists (
      select 1 from public.swipes s
      where s.swiper_id = user_a_id and s.swiped_id = user_b_id and s.direction = 'like'
    )
    and exists (
      select 1 from public.swipes s
      where s.swiper_id = user_b_id and s.swiped_id = user_a_id and s.direction = 'like'
    )
  );

-- deleteMatch() (lib/api.ts, "Vriend verwijderen" on SporterProfileScreen)
-- had no matching DELETE policy before this - RLS defaults to denying a
-- command with no applicable policy, so every delete silently affected
-- zero rows and the button did nothing.
create policy "Match participants can delete their match"
  on public.matches for delete
  to authenticated
  using (auth.uid() = user_a_id or auth.uid() = user_b_id);

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
        and not exists (
          select 1 from public.blocks b
          where (b.blocker_id = m.user_a_id and b.blocked_id = m.user_b_id)
             or (b.blocker_id = m.user_b_id and b.blocked_id = m.user_a_id)
        )
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

-- selectPendingPlan()/upsertSubscription() (lib/api.ts) both .upsert() -
-- Postgres compiles that to INSERT ... ON CONFLICT DO UPDATE, which needs
-- INSERT privilege even when the row already exists and the statement
-- ends up just updating it. Without this policy that upsert is blocked by
-- RLS unconditionally - see supabase/migrations/0007_subscriptions_insert_policy.sql.
create policy "Users can insert their own subscription"
  on public.subscriptions for insert
  to authenticated
  with check (auth.uid() = user_id);

create policy "Users can update their own subscription"
  on public.subscriptions for update
  to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "Users can insert their own support requests"
  on public.support_requests for insert
  to authenticated
  with check (auth.uid() = user_id);

create policy "Users can view their own support requests"
  on public.support_requests for select
  to authenticated
  using (auth.uid() = user_id);

create policy "Users can create their own reports"
  on public.reports for insert
  to authenticated
  with check (auth.uid() = reporter_id);

create policy "Users can view their own reports"
  on public.reports for select
  to authenticated
  using (auth.uid() = reporter_id);

create policy "Users can create their own blocks"
  on public.blocks for insert
  to authenticated
  with check (auth.uid() = blocker_id);

create policy "Users can view their own blocks"
  on public.blocks for select
  to authenticated
  using (auth.uid() = blocker_id);

create policy "Users can remove their own blocks"
  on public.blocks for delete
  to authenticated
  using (auth.uid() = blocker_id);

-- ─────────────────────────────────────────────────────────────────────────
-- Realtime: broadcast changes on messages and matches for the chat screens
-- ─────────────────────────────────────────────────────────────────────────
alter publication supabase_realtime add table public.messages;
alter publication supabase_realtime add table public.matches;
alter publication supabase_realtime add table public.posts;
alter publication supabase_realtime add table public.post_likes;

-- ─────────────────────────────────────────────────────────────────────────
-- Storage: profile photo uploads ("Profiel bewerken" screen)
-- ─────────────────────────────────────────────────────────────────────────
-- Note: if this project already existed before this bucket/these policies
-- were added to this file, run
-- supabase/migrations/0009_profile_photos_storage.sql to patch it - the
-- statements below are otherwise identical and safe to run again.

insert into storage.buckets (id, name, public)
values ('profile-photos', 'profile-photos', true)
on conflict (id) do nothing;

drop policy if exists "Profile photos are publicly readable" on storage.objects;
create policy "Profile photos are publicly readable"
  on storage.objects for select
  to public
  using (bucket_id = 'profile-photos');

drop policy if exists "Users can upload their own profile photos" on storage.objects;
create policy "Users can upload their own profile photos"
  on storage.objects for insert
  to authenticated
  with check (bucket_id = 'profile-photos' and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists "Users can update their own profile photos" on storage.objects;
create policy "Users can update their own profile photos"
  on storage.objects for update
  to authenticated
  using (bucket_id = 'profile-photos' and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists "Users can delete their own profile photos" on storage.objects;
create policy "Users can delete their own profile photos"
  on storage.objects for delete
  to authenticated
  using (bucket_id = 'profile-photos' and (storage.foldername(name))[1] = auth.uid()::text);

-- ─────────────────────────────────────────────────────────────────────────
-- Location privacy: exact coordinates are never readable via a plain
-- column read (see the "revoke select on public.profiles" above) - these
-- two SECURITY DEFINER functions are the only way to get at them, and
-- neither one leaks a raw coordinate to anyone but the profile's own
-- owner. See supabase/migrations/0014_discover_profiles_location_privacy.sql
-- for the full write-up.
-- ─────────────────────────────────────────────────────────────────────────

-- The calling user's own exact coordinates - used by AuthContext's
-- location check and the "Mijn gegevens opvragen" export, both of which
-- legitimately need the owner's own raw location.
create or replace function public.get_my_location()
returns table (latitude double precision, longitude double precision, city text)
language sql
security definer
set search_path = public
stable
as $$
  select p.latitude, p.longitude, p.city
  from public.profiles p
  where p.id = auth.uid()
$$;

grant execute on function public.get_my_location() to authenticated;

-- Powers the Ontdekken feed (fetchDiscoverProfiles, lib/api.ts): computes
-- distance server-side from the caller's own coordinates (via auth.uid(),
-- never a parameter - a viewer id parameter would let anyone query
-- distances relative to someone else's location instead of their own) so
-- raw coordinates for any *other* profile never leave the database at
-- all, only the resulting distance_km. Mirrors fetchDiscoverProfiles's
-- previous client-side filtering exactly: same sport/search-radius
-- fallback to the caller's own profile, same "no location set = no
-- distance narrowing" degradation, same visibility/block/already-swiped
-- exclusions RLS would otherwise apply (this function runs SECURITY
-- DEFINER and so bypasses RLS internally - those checks are re-implemented
-- here by hand instead).
create or replace function public.discover_profiles(
  p_sport text default null,
  p_level text default null,
  p_max_age int default null,
  p_distance_km double precision default null,
  p_limit int default 20
)
returns table (
  id uuid,
  full_name text,
  birthdate date,
  gender text,
  bio text,
  sport text,
  level text,
  city text,
  search_radius_km int,
  avatar_url text,
  photo_url text,
  distance_km double precision
)
language plpgsql
security definer
set search_path = public
stable
as $$
declare
  v_uid uuid := auth.uid();
  v_my_sport text;
  v_my_lat double precision;
  v_my_lng double precision;
  v_my_radius_km double precision;
  v_sport text;
  v_radius_km double precision;
  v_min_birthdate date;
  v_max_birthdate date;
begin
  if v_uid is null then
    raise exception 'Not authenticated';
  end if;

  select p.sport, p.latitude, p.longitude, p.search_radius_km
    into v_my_sport, v_my_lat, v_my_lng, v_my_radius_km
  from public.profiles p
  where p.id = v_uid;

  v_sport := coalesce(p_sport, v_my_sport);
  v_radius_km := coalesce(p_distance_km, v_my_radius_km);

  if p_max_age is not null then
    v_min_birthdate := (current_date - (p_max_age || ' years')::interval)::date;
    v_max_birthdate := (current_date - interval '18 years')::date;
  end if;

  return query
  with candidates as (
    select p.*
    from public.profiles p
    where p.id <> v_uid
      and p.profile_visible = true
      and not exists (select 1 from public.swipes s where s.swiper_id = v_uid and s.swiped_id = p.id)
      and not exists (
        select 1 from public.blocks b
        where (b.blocker_id = v_uid and b.blocked_id = p.id)
           or (b.blocker_id = p.id and b.blocked_id = v_uid)
      )
      and (v_sport is null or p.sport = v_sport)
      and (p_level is null or p.level = p_level)
      and (v_min_birthdate is null or p.birthdate >= v_min_birthdate)
      and (v_max_birthdate is null or p.birthdate <= v_max_birthdate)
    limit 50
  ),
  with_distance as (
    select
      c.id, c.full_name, c.birthdate, c.gender, c.bio, c.sport, c.level, c.city,
      c.search_radius_km, c.avatar_url, c.photo_url,
      case
        when v_my_lat is not null and v_my_lng is not null and c.latitude is not null and c.longitude is not null
        then 6371 * 2 * asin(least(1.0, sqrt(
               sin(radians((c.latitude - v_my_lat) / 2)) ^ 2
               + cos(radians(v_my_lat)) * cos(radians(c.latitude))
               * sin(radians((c.longitude - v_my_lng) / 2)) ^ 2
             )))
        else null
      end as distance_km
    from candidates c
  )
  select w.id, w.full_name, w.birthdate, w.gender, w.bio, w.sport, w.level, w.city,
         w.search_radius_km, w.avatar_url, w.photo_url, w.distance_km
  from with_distance w
  where
    -- Only apply the radius cutoff when the viewer actually has a location
    -- and a radius to compare against - no location set means no
    -- distance-based narrowing at all, same as before.
    (v_my_lat is null or v_my_lng is null or v_radius_km is null)
    or (w.distance_km is not null and w.distance_km <= v_radius_km)
  order by (case when w.distance_km is null then 1 else 0 end), w.distance_km asc nulls last
  limit p_limit;
end;
$$;

grant execute on function public.discover_profiles(text, text, int, double precision, int) to authenticated;
