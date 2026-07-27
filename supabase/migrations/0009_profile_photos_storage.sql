-- Backs the "Profiel bewerken" screen's photo upload, which previously
-- had no upload functionality at all - the photo shown there was always
-- a placeholder image, never the user's real profiles.photo_url, and
-- there was no way to pick or upload a new one.
--
-- Creates a public storage bucket and RLS policies scoping uploads/edits
-- to a user's own folder (path convention: "<user_id>/<filename>",
-- enforced via storage.foldername(name)[1] = auth.uid()::text - the
-- standard Supabase pattern for per-user storage folders). The bucket is
-- public for reads: profile photos are already shown to any authenticated
-- user browsing Ontdekken/matches/etc, same as every other photo URL in
-- this app (all public HTTPS URLs, no signed URLs anywhere) - a public
-- bucket keeps that consistent instead of introducing a different access
-- model just for uploaded photos.
--
-- Run this via `supabase db push` or paste into the Supabase SQL editor.
-- Safe to run more than once.

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
