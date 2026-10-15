-- In-app meldingencentrum: een 'notifications'-tabel, gevuld via
-- database-triggers bij een nieuwe match, een nieuw bericht (voor de
-- ontvanger), en een afgehandelde rapportage (voor de melder) - zie
-- README.md §"Meldingencentrum" voor de volledige uitleg en de
-- client-kant (NotificationsScreen.tsx, TopBar.tsx's belletje-icoon).
--
-- Run dit via `supabase db push` of plak het in de Supabase SQL editor.
-- Veilig om vaker te draaien (`create table if not exists`, elke
-- policy/trigger wordt eerst gedropt, `create or replace function`).
--
-- ─────────────────────────────────────────────────────────────────────────
-- Verify na het draaien:
-- ─────────────────────────────────────────────────────────────────────────
-- select
--   (select count(*) from pg_proc where proname = 'notify_on_new_match' and pronamespace = 'public'::regnamespace) as has_match_fn,
--   (select count(*) from pg_proc where proname = 'notify_on_new_message' and pronamespace = 'public'::regnamespace) as has_message_fn,
--   (select count(*) from pg_proc where proname = 'notify_on_report_resolved' and pronamespace = 'public'::regnamespace) as has_report_fn,
--   (select count(*) from pg_trigger where tgname = 'notify_new_match' and not tgisinternal) as has_match_trigger,
--   (select count(*) from pg_trigger where tgname = 'notify_new_message' and not tgisinternal) as has_message_trigger,
--   (select count(*) from pg_trigger where tgname = 'notify_report_resolved' and not tgisinternal) as has_report_trigger,
--   (select count(*) from pg_policies where schemaname = 'public' and tablename = 'notifications' and cmd = 'SELECT') as select_policy,
--   (select count(*) from pg_policies where schemaname = 'public' and tablename = 'notifications' and cmd = 'UPDATE') as update_policy,
--   (select count(*) from pg_policies where schemaname = 'public' and tablename = 'notifications' and cmd = 'INSERT') as insert_policy;
-- -- verwacht: 1, 1, 1, 1, 1, 1, 1, 1, 0 (geen INSERT-policy - alleen de
-- -- (security definer) triggerfuncties mogen rijen aanmaken, niet de client zelf)
-- ─────────────────────────────────────────────────────────────────────────

-- ─────────────────────────────────────────────────────────────────────────
-- notifications: reference_id verwijst, afhankelijk van `type`, naar een
-- matches.id ('match'/'message' - hetzelfde id dat ChatDetail als chatId
-- gebruikt) of een reports.id ('moderation_update'). Bewust geen foreign
-- key op reference_id (kan niet, het wijst naar verschillende tabellen
-- afhankelijk van type) - zelfde polymorfe patroon als
-- flagged_content.source_table/source_id uit 0027_content_filter.sql.
-- ─────────────────────────────────────────────────────────────────────────
create table if not exists public.notifications (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  type text not null check (type in ('match', 'message', 'moderation_update')),
  reference_id uuid not null,
  is_read boolean not null default false,
  created_at timestamptz not null default now()
);

create index if not exists notifications_user_id_created_at_idx on public.notifications (user_id, created_at desc);
-- Partial index - alleen de ongelezen rijen, precies wat het belletje-
-- badge (fetchUnreadNotificationCount(), lib/api.ts) en NotificationsScreen
-- ("markeer als gelezen") opvragen/wijzigen.
create index if not exists notifications_user_id_unread_idx on public.notifications (user_id) where not is_read;

alter table public.notifications enable row level security;

drop policy if exists "Users can view their own notifications" on public.notifications;
create policy "Users can view their own notifications"
  on public.notifications for select
  to authenticated
  using (auth.uid() = user_id);

-- Alleen UPDATE (voor "markeer als gelezen" - NotificationsScreen.tsx),
-- bewust GEEN INSERT-policy: een melding aanmaken is uitsluitend iets wat
-- de (security definer) triggerfuncties hieronder doen, nooit de client
-- zelf - anders zou een account voor zichzelf nepmeldingen kunnen
-- aanmaken.
drop policy if exists "Users can update their own notifications" on public.notifications;
create policy "Users can update their own notifications"
  on public.notifications for update
  to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- ─────────────────────────────────────────────────────────────────────────
-- Trigger 1: nieuwe match -> melding voor beide betrokkenen
-- ─────────────────────────────────────────────────────────────────────────
create or replace function public.notify_on_new_match()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.notifications (user_id, type, reference_id) values
    (new.user_a_id, 'match', new.id),
    (new.user_b_id, 'match', new.id);
  return new;
end;
$$;

drop trigger if exists notify_new_match on public.matches;
create trigger notify_new_match
  after insert on public.matches
  for each row execute function public.notify_on_new_match();

-- ─────────────────────────────────────────────────────────────────────────
-- Trigger 2: nieuw bericht -> melding voor de ontvanger (niet de afzender)
-- ─────────────────────────────────────────────────────────────────────────
create or replace function public.notify_on_new_message()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_receiver_id uuid;
begin
  select case when m.user_a_id = new.sender_id then m.user_b_id else m.user_a_id end
    into v_receiver_id
  from public.matches m
  where m.id = new.match_id;

  if v_receiver_id is not null then
    insert into public.notifications (user_id, type, reference_id)
    values (v_receiver_id, 'message', new.match_id);
  end if;

  return new;
end;
$$;

drop trigger if exists notify_new_message on public.messages;
create trigger notify_new_message
  after insert on public.messages
  for each row execute function public.notify_on_new_message();

-- ─────────────────────────────────────────────────────────────────────────
-- Trigger 3: rapportage afgehandeld -> melding voor de melder
-- (`update of status`, en alleen bij een daadwerkelijke overgang náár
-- 'resolved' - voorkomt een dubbele melding als status om wat voor reden
-- dan ook nogmaals op 'resolved' gezet zou worden).
-- ─────────────────────────────────────────────────────────────────────────
create or replace function public.notify_on_report_resolved()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.status = 'resolved' and old.status is distinct from 'resolved' then
    insert into public.notifications (user_id, type, reference_id)
    values (new.reporter_id, 'moderation_update', new.id);
  end if;
  return new;
end;
$$;

drop trigger if exists notify_report_resolved on public.reports;
create trigger notify_report_resolved
  after update of status on public.reports
  for each row execute function public.notify_on_report_resolved();

-- ─────────────────────────────────────────────────────────────────────────
-- Self-check: raist een specifieke EXCEPTION i.p.v. een dubbelzinnige
-- "Success" - zelfde aanpak als 0022-0031.
-- ─────────────────────────────────────────────────────────────────────────
do $$
begin
  if to_regclass('public.notifications') is null then
    raise exception 'public.notifications bestaat niet.';
  end if;

  if not exists (select 1 from pg_proc where proname = 'notify_on_new_match' and pronamespace = 'public'::regnamespace) then
    raise exception 'notify_on_new_match() bestaat niet.';
  end if;
  if not exists (select 1 from pg_proc where proname = 'notify_on_new_message' and pronamespace = 'public'::regnamespace) then
    raise exception 'notify_on_new_message() bestaat niet.';
  end if;
  if not exists (select 1 from pg_proc where proname = 'notify_on_report_resolved' and pronamespace = 'public'::regnamespace) then
    raise exception 'notify_on_report_resolved() bestaat niet.';
  end if;

  if not exists (select 1 from pg_trigger where tgname = 'notify_new_match' and not tgisinternal) then
    raise exception 'De trigger notify_new_match op matches ontbreekt.';
  end if;
  if not exists (select 1 from pg_trigger where tgname = 'notify_new_message' and not tgisinternal) then
    raise exception 'De trigger notify_new_message op messages ontbreekt.';
  end if;
  if not exists (select 1 from pg_trigger where tgname = 'notify_report_resolved' and not tgisinternal) then
    raise exception 'De trigger notify_report_resolved op reports ontbreekt.';
  end if;

  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'notifications' and cmd = 'SELECT') then
    raise exception 'SELECT-policy op notifications ontbreekt.';
  end if;
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'notifications' and cmd = 'UPDATE') then
    raise exception 'UPDATE-policy op notifications ontbreekt.';
  end if;
  if exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'notifications' and cmd = 'INSERT') then
    raise exception 'notifications heeft een INSERT-policy voor authenticated - die had er bewust niet moeten zijn (alleen de triggerfuncties mogen rijen aanmaken).';
  end if;

  raise notice 'notifications, alle drie de triggerfuncties/triggers en de RLS-policies (SELECT+UPDATE, geen INSERT) zijn correct opgezet.';
end $$;
