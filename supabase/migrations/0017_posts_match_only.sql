-- Posts were readable by any authenticated user ("Posts are readable by
-- authenticated users", using (true)) - a fully public feed. This
-- restricts a post to being readable only by its own author or by
-- someone who has an existing match with that author, matching the
-- Connecties tab's intent: "Bericht plaatsen" content should stay within
-- your own network of matches, not be visible to every signed-in user.
--
-- Enforced here at the database level - this is the actual boundary a
-- client can't bypass, not just a query-side filter. lib/api.ts's
-- fetchConnectionPosts() applies the same restriction client-side for
-- the Connecties tab (so its intent is explicit in the code, not just
-- relying on rows silently disappearing), but this policy is what
-- actually prevents a hand-crafted API call from reading a stranger's
-- post.
--
-- Side effect worth knowing about: this also narrows the "Berichten"
-- feed (PostsFeedScreen, which calls the unfiltered fetchPosts()) to the
-- same subset - own posts and posts by an existing match - since RLS
-- applies to every reader of this table regardless of which screen's
-- query reaches it. There's no way to enforce this "only for the
-- Connecties tab" at the database level; RLS can't distinguish which
-- screen originated a query.
--
-- Run this via `supabase db push` or paste into the Supabase SQL editor.
-- Safe to run more than once. 0001_init.sql has been updated to match
-- for fresh installs.

drop policy if exists "Posts are readable by authenticated users" on public.posts;
drop policy if exists "Posts are readable by their author or a match" on public.posts;
create policy "Posts are readable by their author or a match"
  on public.posts for select
  to authenticated
  using (
    auth.uid() = author_id
    or exists (
      select 1 from public.matches m
      where (m.user_a_id = auth.uid() and m.user_b_id = posts.author_id)
         or (m.user_b_id = auth.uid() and m.user_a_id = posts.author_id)
    )
  );
