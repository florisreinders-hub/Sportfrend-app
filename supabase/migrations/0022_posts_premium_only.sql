-- Makes the "prikbord" (posts / post_likes - "Bericht plaatsen" on the
-- Connecties tab and the public Berichten feed) a Premium/Elite-only
-- feature, per the Pricing screen: Basis can't post, and can't read
-- anyone else's posts either. Enforced here via RLS on `posts` and
-- `post_likes` themselves - the actual boundary a client can't bypass,
-- not just a hidden button. This is deliberately unrelated to 1:1 chat
-- (`messages`) or its own daily limit (0020_messages_daily_limit.sql) -
-- chat stays available to every plan.
--
-- Side effect worth knowing about, same kind as 0017_posts_match_only.sql:
-- RLS applies to every reader/writer of `posts`/`post_likes` regardless of
-- which screen's query reaches them, so this also fully blocks Basis
-- accounts from the separate public "Berichten" feed (PostsFeedScreen,
-- fetchPosts()) and from seeing another profile's posts on
-- SporterProfileScreen (fetchPostsByAuthor()) - there's no way to scope
-- RLS "only for the Connecties tab". HomeScreen.tsx and PostsFeedScreen.tsx
-- have both been updated with a matching upgrade prompt so a Basis account
-- gets a clear explanation instead of a silently empty feed in either
-- place; SporterProfileScreen.tsx's own posts section isn't in scope for
-- this change and will just show its existing "no posts yet" empty state
-- for a Basis viewer, which is not accurate (the other profile may well
-- have posts, the viewer just can't see them) but not misleading in an
-- unsafe way either - noted here for anyone picking this up later.
--
-- Run this via `supabase db push` or paste into the Supabase SQL editor.
-- Safe to run more than once. 0001_init.sql has been updated to match for
-- fresh installs.
--
-- ─────────────────────────────────────────────────────────────────────────
-- Verify after applying:
-- ─────────────────────────────────────────────────────────────────────────
-- select
--   (select count(*) from pg_proc where proname = 'has_posts_access' and pronamespace = 'public'::regnamespace) as has_function,
--   (select count(*) from pg_policies where schemaname = 'public' and tablename = 'posts'
--      and policyname = 'Posts are readable by their author or a match' and qual ilike '%has_posts_access%') as select_gated,
--   (select count(*) from pg_policies where schemaname = 'public' and tablename = 'posts'
--      and policyname = 'Users manage their own posts' and with_check ilike '%has_posts_access%') as insert_gated,
--   (select count(*) from pg_policies where schemaname = 'public' and tablename = 'posts'
--      and policyname = 'Users can delete their own posts' and qual ilike '%has_posts_access%') as delete_gated,
--   (select count(*) from pg_policies where schemaname = 'public' and tablename = 'post_likes'
--      and policyname = 'Likes are readable by authenticated users' and qual ilike '%has_posts_access%') as likes_select_gated,
--   (select count(*) from pg_policies where schemaname = 'public' and tablename = 'post_likes'
--      and policyname = 'Users manage their own likes' and qual ilike '%has_posts_access%' and with_check ilike '%has_posts_access%') as likes_all_gated;
-- -- expect: 1, 1, 1, 1, 1, 1
--
-- If any of those come back 0 despite the script above reporting
-- "Success", this file's own trailing `do $$ ... $$` self-check block
-- (bottom of this file) will raise a specific exception naming exactly
-- which piece is missing the next time you run the whole file - re-run it
-- and read that error rather than guessing. To see the *current* raw
-- state without re-running anything:
--
-- select 'function exists' as check, (exists (
--   select 1 from pg_proc where proname = 'has_posts_access' and pronamespace = 'public'::regnamespace
-- ))::text as result
-- union all
-- select 'posts SELECT qual', coalesce((select qual from pg_policies
--   where schemaname='public' and tablename='posts' and policyname='Posts are readable by their author or a match'), '<policy not found>')
-- union all
-- select 'posts INSERT with_check', coalesce((select with_check from pg_policies
--   where schemaname='public' and tablename='posts' and policyname='Users manage their own posts'), '<policy not found>')
-- union all
-- select 'posts DELETE qual', coalesce((select qual from pg_policies
--   where schemaname='public' and tablename='posts' and policyname='Users can delete their own posts'), '<policy not found>')
-- union all
-- select 'post_likes SELECT qual', coalesce((select qual from pg_policies
--   where schemaname='public' and tablename='post_likes' and policyname='Likes are readable by authenticated users'), '<policy not found>')
-- union all
-- select 'post_likes ALL qual', coalesce((select qual from pg_policies
--   where schemaname='public' and tablename='post_likes' and policyname='Users manage their own likes'), '<policy not found>')
-- union all
-- select 'post_likes ALL with_check', coalesce((select with_check from pg_policies
--   where schemaname='public' and tablename='post_likes' and policyname='Users manage their own likes'), '<policy not found>');
--
-- This prints the actual policy text (or "<policy not found>") for each
-- check instead of a bare 0/1 - if a policy's text is the *old* condition
-- without "has_posts_access" in it, the DROP POLICY/CREATE POLICY pair for
-- it never actually ran (most likely cause: only part of this file got
-- executed - e.g. a highlighted selection in the SQL editor runs only the
-- selection, not the whole pasted script - or this ran against a
-- different Supabase project/branch than the one this check queries).

-- ─────────────────────────────────────────────────────────────────────────
-- has_posts_access: single source of truth for "may this caller use the
-- posts/post_likes feature at all" - only an active Premium or Elite
-- subscription qualifies (a 'pending' plan, i.e. selected on the Pricing
-- screen but never actually "paid" - see selectPendingPlan in lib/api.ts -
-- doesn't count, same as every other plan check in this app). No rows at
-- all (never subscribed) also means false, same as elsewhere defaulting
-- an absent subscription to Basis.
-- ─────────────────────────────────────────────────────────────────────────
create or replace function public.has_posts_access()
returns boolean
language plpgsql
security definer
set search_path = public
stable
as $$
declare
  v_uid uuid := auth.uid();
begin
  if v_uid is null then
    return false;
  end if;

  return exists (
    select 1 from public.subscriptions s
    where s.user_id = v_uid and s.status = 'active' and s.plan in ('premium', 'elite')
  );
end;
$$;

grant execute on function public.has_posts_access() to authenticated;

-- posts: select/insert/delete all gated in addition to their existing
-- author/match conditions - a Basis account gets zero access, not a
-- narrowed view.
drop policy if exists "Posts are readable by their author or a match" on public.posts;
create policy "Posts are readable by their author or a match"
  on public.posts for select
  to authenticated
  using (
    public.has_posts_access()
    and (
      auth.uid() = author_id
      or exists (
        select 1 from public.matches m
        where (m.user_a_id = auth.uid() and m.user_b_id = posts.author_id)
           or (m.user_b_id = auth.uid() and m.user_a_id = posts.author_id)
      )
    )
  );

drop policy if exists "Users manage their own posts" on public.posts;
create policy "Users manage their own posts"
  on public.posts for insert
  to authenticated
  with check (auth.uid() = author_id and public.has_posts_access());

drop policy if exists "Users can delete their own posts" on public.posts;
create policy "Users can delete their own posts"
  on public.posts for delete
  to authenticated
  using (auth.uid() = author_id and public.has_posts_access());

-- post_likes: was fully public-read ("using (true)") - now gated the same
-- way. The insert/update/delete policy ("for all") is likewise gated in
-- both directions, so a Basis account can't like/unlike a post even if it
-- somehow knew a post_id.
drop policy if exists "Likes are readable by authenticated users" on public.post_likes;
create policy "Likes are readable by authenticated users"
  on public.post_likes for select
  to authenticated
  using (public.has_posts_access());

drop policy if exists "Users manage their own likes" on public.post_likes;
create policy "Users manage their own likes"
  on public.post_likes for all
  to authenticated
  using (auth.uid() = user_id and public.has_posts_access())
  with check (auth.uid() = user_id and public.has_posts_access());

-- ─────────────────────────────────────────────────────────────────────────
-- Self-check: raises a specific error if anything above didn't actually
-- take effect, instead of the SQL editor's generic "Success" leaving that
-- ambiguous. Added after a report where running this file showed
-- "Success" yet the separate verification query below still returned all
-- 0s - most likely explanation is that only part of a pasted script
-- executed (e.g. a highlighted selection in the SQL editor only runs the
-- selection, not the whole buffer) or it ran against a different
-- project/branch than the one being verified afterwards; this block
-- can't detect *which* of those happened, but it does guarantee that
-- silently doing nothing is no longer possible for this migration itself
-- - either every check below passes and it prints a NOTICE, or it raises
-- an EXCEPTION naming exactly what's missing.
-- ─────────────────────────────────────────────────────────────────────────
do $$
begin
  if not exists (
    select 1 from pg_proc where proname = 'has_posts_access' and pronamespace = 'public'::regnamespace
  ) then
    raise exception 'has_posts_access() does not exist - the CREATE FUNCTION statement above did not run (or ran against a different database than this check).';
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'posts'
      and policyname = 'Posts are readable by their author or a match'
      and qual ilike '%has_posts_access%'
  ) then
    raise exception 'posts SELECT policy ("Posts are readable by their author or a match") does not reference has_posts_access() - it was not updated.';
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'posts'
      and policyname = 'Users manage their own posts'
      and with_check ilike '%has_posts_access%'
  ) then
    raise exception 'posts INSERT policy ("Users manage their own posts") does not reference has_posts_access() - it was not updated.';
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'posts'
      and policyname = 'Users can delete their own posts'
      and qual ilike '%has_posts_access%'
  ) then
    raise exception 'posts DELETE policy ("Users can delete their own posts") does not reference has_posts_access() - it was not updated.';
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'post_likes'
      and policyname = 'Likes are readable by authenticated users'
      and qual ilike '%has_posts_access%'
  ) then
    raise exception 'post_likes SELECT policy ("Likes are readable by authenticated users") does not reference has_posts_access() - it was not updated.';
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'post_likes'
      and policyname = 'Users manage their own likes'
      and qual ilike '%has_posts_access%' and with_check ilike '%has_posts_access%'
  ) then
    raise exception 'post_likes ALL policy ("Users manage their own likes") does not reference has_posts_access() in both its using and with check clauses - it was not updated.';
  end if;

  raise notice 'has_posts_access() and all 5 posts/post_likes policies are correctly in place.';
end $$;
