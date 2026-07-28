-- RLS security audit fixes. Run this via `supabase db push` or paste into
-- the Supabase SQL editor. Safe to run more than once.
--
-- Fixes five issues found while auditing every RLS policy in the project:
--
-- 1. swipes had no policy letting a user see a 'like' swipe directed at
--    them (only their own outgoing swipes) - recordSwipe()'s mutual-like
--    check (lib/api.ts) could therefore never actually see the other
--    person's row, so two people liking each other never produced a
--    match. Fix: add a narrow SELECT policy for incoming 'like' swipes
--    only (skips stay hidden).
--
-- 2. matches had no server-side check that both people had actually liked
--    each other before insert - any authenticated user could call the API
--    directly and force a "match" (and therefore messaging ability) with
--    anyone, bypassing the double opt-in the app's own UI enforces only
--    client-side. Fix: require both reciprocal 'like' swipes to exist in
--    the INSERT policy's WITH CHECK.
--
-- 3. matches had no DELETE policy at all, so "Vriend verwijderen" on
--    SporterProfileScreen silently affected zero rows (RLS denies by
--    default when no policy applies to a command). Fix: add a DELETE
--    policy for match participants.
--
-- 4. profiles' SELECT policy didn't enforce the "Profiel zichtbaar voor
--    anderen" toggle (profiles.profile_visible) at all - it was only
--    applied as a client-side filter in the Ontdekken query
--    (fetchDiscoverProfiles), so anyone who had (or guessed/enumerated) a
--    user's id could still read their full profile directly, toggle or
--    not. Fix: only allow reading an invisible profile if you already
--    have a match with that person (so existing chats/connections keep
--    working) or it's your own row.
--
-- 5. profiles.expo_push_token was readable by every authenticated user via
--    plain `select("*")` (used throughout the app) - since Expo's push API
--    accepts a bare token with no further authentication, that's enough
--    for any signed-in user to send any other user arbitrary spoofed push
--    notifications. Fix: revoke column-level SELECT on expo_push_token for
--    the `authenticated` role (writes are untouched). The app's own
--    queries were updated to select an explicit column list
--    (lib/api.ts's PROFILE_COLUMNS) instead of "*" so this doesn't break
--    reading your own profile either.

-- ─────────────────────────────────────────────────────────────────────────
-- 1. swipes: let a user see 'like' swipes directed at them
-- ─────────────────────────────────────────────────────────────────────────
drop policy if exists "Users can see likes directed at them" on public.swipes;
create policy "Users can see likes directed at them"
  on public.swipes for select
  to authenticated
  using (auth.uid() = swiped_id and direction = 'like');

-- ─────────────────────────────────────────────────────────────────────────
-- 2 & 3. matches: require mutual likes to insert, add a DELETE policy
-- ─────────────────────────────────────────────────────────────────────────
drop policy if exists "Matches are created by the matching function" on public.matches;
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

drop policy if exists "Match participants can delete their match" on public.matches;
create policy "Match participants can delete their match"
  on public.matches for delete
  to authenticated
  using (auth.uid() = user_a_id or auth.uid() = user_b_id);

-- ─────────────────────────────────────────────────────────────────────────
-- 4. profiles: enforce profile_visible at the RLS layer too
-- ─────────────────────────────────────────────────────────────────────────
drop policy if exists "Profiles are readable by authenticated users" on public.profiles;
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

-- ─────────────────────────────────────────────────────────────────────────
-- 5. profiles: revoke SELECT on expo_push_token specifically
-- ─────────────────────────────────────────────────────────────────────────
revoke select on public.profiles from authenticated;
grant select (
  id, full_name, birthdate, gender, bio, sport, level, city, latitude, longitude,
  search_radius_km, avatar_url, photo_url, is_onboarded, push_notifications_enabled,
  profile_visible, availability_days, created_at, updated_at
) on public.profiles to authenticated;
