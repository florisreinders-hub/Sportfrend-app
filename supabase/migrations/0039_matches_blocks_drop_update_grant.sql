-- 0037_public_schema_table_grants.sql gaf authenticated select, insert,
-- update, delete op public.matches en public.blocks - de update stond
-- erbij omdat recordSwipe() en blockUser() destijds een plain .upsert()
-- deden, en PostgREST maakt daar standaard ON CONFLICT DO UPDATE van (dus
-- UPDATE-rechten nodig bij een bestaande rij).
--
-- Sindsdien gebruiken beide functies in lib/api.ts ignoreDuplicates: true
-- op hun upsert, dus PostgREST maakt er ON CONFLICT DO NOTHING van - er
-- wordt nooit meer geüpdatet, alleen gelezen, ingevoegd of verwijderd.
-- UPDATE is dus overbodig geworden en wordt hier ingetrokken.
--
-- 0037 en 0038 zijn al live gedraaid en blijven daarom ongewijzigd; deze
-- migratie trekt alleen terug wat 0037 destijds gaf.
begin;

revoke update on public.matches, public.blocks from authenticated;

do $$
begin
  if has_table_privilege('authenticated', 'public.matches', 'update') then
    raise exception 'authenticated heeft nog UPDATE op public.matches';
  end if;
  if has_table_privilege('authenticated', 'public.blocks', 'update') then
    raise exception 'authenticated heeft nog UPDATE op public.blocks';
  end if;

  if not has_table_privilege('authenticated', 'public.matches', 'select') then
    raise exception 'authenticated mist SELECT op public.matches';
  end if;
  if not has_table_privilege('authenticated', 'public.matches', 'insert') then
    raise exception 'authenticated mist INSERT op public.matches';
  end if;
  if not has_table_privilege('authenticated', 'public.matches', 'delete') then
    raise exception 'authenticated mist DELETE op public.matches';
  end if;

  if not has_table_privilege('authenticated', 'public.blocks', 'select') then
    raise exception 'authenticated mist SELECT op public.blocks';
  end if;
  if not has_table_privilege('authenticated', 'public.blocks', 'insert') then
    raise exception 'authenticated mist INSERT op public.blocks';
  end if;
  if not has_table_privilege('authenticated', 'public.blocks', 'delete') then
    raise exception 'authenticated mist DELETE op public.blocks';
  end if;

  if has_table_privilege('anon', 'public.matches', 'select')
    or has_table_privilege('anon', 'public.matches', 'insert')
    or has_table_privilege('anon', 'public.matches', 'update')
    or has_table_privilege('anon', 'public.matches', 'delete')
  then
    raise exception 'anon heeft onverwacht een recht op public.matches';
  end if;
  if has_table_privilege('anon', 'public.blocks', 'select')
    or has_table_privilege('anon', 'public.blocks', 'insert')
    or has_table_privilege('anon', 'public.blocks', 'update')
    or has_table_privilege('anon', 'public.blocks', 'delete')
  then
    raise exception 'anon heeft onverwacht een recht op public.blocks';
  end if;

  if not has_table_privilege('service_role', 'public.matches', 'select')
    or not has_table_privilege('service_role', 'public.matches', 'insert')
    or not has_table_privilege('service_role', 'public.matches', 'update')
    or not has_table_privilege('service_role', 'public.matches', 'delete')
  then
    raise exception 'service_role mist een recht op public.matches';
  end if;
  if not has_table_privilege('service_role', 'public.blocks', 'select')
    or not has_table_privilege('service_role', 'public.blocks', 'insert')
    or not has_table_privilege('service_role', 'public.blocks', 'update')
    or not has_table_privilege('service_role', 'public.blocks', 'delete')
  then
    raise exception 'service_role mist een recht op public.blocks';
  end if;

  raise notice '0039: grants op matches/blocks kloppen (authenticated zonder update, anon niets, service_role alles)';
end $$;

commit;
