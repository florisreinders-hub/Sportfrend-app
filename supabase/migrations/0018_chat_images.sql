-- Adds the ability to send an image as a chat message (ChatDetailScreen):
-- a Storage bucket for uploaded chat images, RLS policies scoping upload/
-- delete to the two participants of the relevant match, and an
-- `image_url` column on `public.messages` to hold the resulting public URL.
--
-- Path convention: "<match_id>/<sender_id>-<timestamp>.<ext>" - unlike
-- profile-photos (0009_profile_photos_storage.sql, scoped per-user), a
-- chat image must be readable by BOTH participants of the match, not just
-- its sender, so the folder is keyed by match_id and the write/delete
-- policies check match membership via public.matches instead of "the
-- uploader's own id". The bucket is public for reads, consistent with
-- every other photo URL in this app (profile photos, post images - none
-- of which use signed URLs); the real access boundary is that the path is
-- only ever handed to the two match participants, same trust model as
-- those.
--
-- No RLS change needed on public.messages itself - the existing
-- "Match participants can read/send messages" policies already cover the
-- whole row regardless of which columns it has.
--
-- Run this via `supabase db push` or paste into the Supabase SQL editor.
-- Safe to run more than once. 0001_init.sql has been updated to match for
-- fresh installs.

alter table public.messages add column if not exists image_url text;

insert into storage.buckets (id, name, public)
values ('chat-images', 'chat-images', true)
on conflict (id) do nothing;

drop policy if exists "Chat images are publicly readable" on storage.objects;
create policy "Chat images are publicly readable"
  on storage.objects for select
  to public
  using (bucket_id = 'chat-images');

drop policy if exists "Match participants can upload chat images" on storage.objects;
create policy "Match participants can upload chat images"
  on storage.objects for insert
  to authenticated
  with check (
    bucket_id = 'chat-images'
    and exists (
      select 1 from public.matches m
      where m.id::text = (storage.foldername(name))[1]
        and (m.user_a_id = auth.uid() or m.user_b_id = auth.uid())
    )
  );

drop policy if exists "Match participants can delete chat images" on storage.objects;
create policy "Match participants can delete chat images"
  on storage.objects for delete
  to authenticated
  using (
    bucket_id = 'chat-images'
    and exists (
      select 1 from public.matches m
      where m.id::text = (storage.foldername(name))[1]
        and (m.user_a_id = auth.uid() or m.user_b_id = auth.uid())
    )
  );
