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
