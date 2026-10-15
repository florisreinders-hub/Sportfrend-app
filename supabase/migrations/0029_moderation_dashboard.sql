-- Basaal moderatie-overzicht, ter voorbereiding op Apple's App Store
-- Review Guideline 1.2 (binnen 24 uur kunnen reageren op gerapporteerde/
-- gemarkeerde content). Alleen toegankelijk voor één specifiek account
-- (e-mailadres-check, geen rollen-tabel/systeem - expliciet zo gevraagd,
-- en dit project heeft nog geen ander gebruik voor rollen).
--
-- ─────────────────────────────────────────────────────────────────────────
-- is_moderator(): de enige plek waar het moderator-e-mailadres staat
-- ─────────────────────────────────────────────────────────────────────────
-- `security definer` omdat `authenticated` zelf geen toegang heeft tot
-- `auth.users` (waar het e-mailadres van de ingelogde gebruiker vandaan
-- moet komen - `auth.uid()` geeft alleen een uuid, geen e-mailadres).
-- Elke RLS-policy hieronder roept deze functie aan in plaats van zelf een
-- e-mailadres te vergelijken, zodat het adres maar op één plek staat -
-- dezelfde reden waarom 0026's daily-limit-functies en 0027/0028's
-- find_flagged_words() ook single-source-of-truth-functies zijn in plaats
-- van inline policy-expressies.
create or replace function public.is_moderator()
returns boolean
language sql
security definer
set search_path = public, auth
stable
as $$
  select exists (
    select 1 from auth.users
    where id = auth.uid()
      and email = 'floris.reinders@gmail.com'
  );
$$;

grant execute on function public.is_moderator() to authenticated;

-- ─────────────────────────────────────────────────────────────────────────
-- reports: moderator mag alles lezen én de status bijwerken (bv. naar
-- 'resolved' - "afgehandeld"). Dit zijn permissive policies, die OR'en met
-- de bestaande "Users can view/create their own reports"-policies uit
-- 0012_moderation_reports_blocks.sql - een gewone gebruiker verliest dus
-- niets, dit voegt alleen toe.
-- ─────────────────────────────────────────────────────────────────────────
drop policy if exists "Moderator can view all reports" on public.reports;
create policy "Moderator can view all reports"
  on public.reports for select
  to authenticated
  using (public.is_moderator());

drop policy if exists "Moderator can update reports" on public.reports;
create policy "Moderator can update reports"
  on public.reports for update
  to authenticated
  using (public.is_moderator())
  with check (public.is_moderator());

-- ─────────────────────────────────────────────────────────────────────────
-- flagged_content: had sinds 0027 bewust GEEN policies (onzichtbaar voor
-- iedereen, ook de gemarkeerde gebruiker zelf). Nu een moderator-only
-- SELECT-policy - alleen-lezen, het overzicht toont dit puur informatief
-- (de "handelen"-actie in het overzicht is de report-status en/of de
-- betrokken gebruiker verwijderen, niet flagged_content zelf wijzigen).
-- ─────────────────────────────────────────────────────────────────────────
drop policy if exists "Moderator can view flagged content" on public.flagged_content;
create policy "Moderator can view flagged content"
  on public.flagged_content for select
  to authenticated
  using (public.is_moderator());

-- ─────────────────────────────────────────────────────────────────────────
-- Verify na het draaien:
-- ─────────────────────────────────────────────────────────────────────────
-- select
--   (select count(*) from pg_proc where proname = 'is_moderator' and pronamespace = 'public'::regnamespace) as has_is_moderator,
--   has_function_privilege('authenticated', 'public.is_moderator()', 'execute') as authenticated_can_call,
--   (select count(*) from pg_policies where tablename = 'reports' and policyname = 'Moderator can view all reports') as reports_select_policy,
--   (select count(*) from pg_policies where tablename = 'reports' and policyname = 'Moderator can update reports') as reports_update_policy,
--   (select count(*) from pg_policies where tablename = 'flagged_content' and policyname = 'Moderator can view flagged content') as flagged_select_policy;
-- -- verwacht: 1, true, 1, 1, 1
--
-- Test het e-mailadres zelf (moet overeenkomen met je eigen account):
-- select email from auth.users where email = 'floris.reinders@gmail.com';
-- ─────────────────────────────────────────────────────────────────────────

do $$
begin
  if not exists (select 1 from pg_proc where proname = 'is_moderator' and pronamespace = 'public'::regnamespace) then
    raise exception 'is_moderator() bestaat niet.';
  end if;

  if has_function_privilege('authenticated', 'public.is_moderator()', 'execute') is not true then
    raise exception 'authenticated kan is_moderator() niet aanroepen.';
  end if;

  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'reports' and policyname = 'Moderator can view all reports') then
    raise exception '"Moderator can view all reports"-policy op reports ontbreekt.';
  end if;

  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'reports' and policyname = 'Moderator can update reports') then
    raise exception '"Moderator can update reports"-policy op reports ontbreekt.';
  end if;

  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'flagged_content' and policyname = 'Moderator can view flagged content') then
    raise exception '"Moderator can view flagged content"-policy op flagged_content ontbreekt.';
  end if;

  raise notice 'is_moderator() en alle drie de moderator-RLS-policies (reports x2, flagged_content x1) zijn correct opgezet.';
end $$;
