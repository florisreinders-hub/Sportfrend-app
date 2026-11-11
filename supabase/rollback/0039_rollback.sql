-- Rollback voor 0039_matches_blocks_drop_update_grant.sql.
-- Niet onderdeel van supabase/migrations, dus niet opgenomen in
-- `supabase db push`/`db reset` - handmatig draaien indien nodig.
begin;

grant update on public.matches, public.blocks to authenticated;

commit;
