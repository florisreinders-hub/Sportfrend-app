-- Breidt "Slimme beschikbaarheids match" uit van alleen dagen naar
-- dag + dagdeel (ochtend/middag/avond), bv. "maandagavond en
-- zaterdagochtend" in plaats van alleen "maandag en zaterdag".
--
-- GEEN SQL-wijziging nodig aan discover_profiles() of aan de
-- kolomrechten: de overlap-check (`p.availability_days &&
-- p_availability_days`, zie 0023_discover_profiles_availability_filter.sql)
-- en de Elite-only clamp (`if v_plan <> 'elite' then p_availability_days
-- := null; end if;`) zijn allebei waarde-onafhankelijk - ze werken op
-- welke strings er ook in de array staan. Alleen het vocabulaire van die
-- strings verandert, van kale dagcodes ('ma') naar dag+dagdeel-codes
-- ('ma-ochtend'). Dit bestand bevat dus UITSLUITEND de eenmalige
-- data-omzetting van bestaande rijen; lib/api.ts/de UI-schermen zorgen
-- dat alle nieuwe writes al in het nieuwe formaat gebeuren.
--
-- Omzetting: elke kale dagcode ('ma', 'di', ..., 'zo') die nog in
-- profiles.availability_days staat wordt vervangen door alle 3 de
-- dagdelen van die dag ('ma-ochtend', 'ma-middag', 'ma-avond') - een
-- gebruiker die voorheen "maandag" aangaf blijft daarmee die hele dag
-- matchen, in plaats van stilletjes helemaal uit de match te vallen.
-- Waarden die al in het nieuwe formaat staan (of iets onverwachts) blijven
-- ongewijzigd.
--
-- begin/commit: zie 0033_terms_acceptance.sql voor waarom - zonder
-- expliciete transactie kan een fout halverwege de UPDATE niet
-- gegarandeerd terugdraaien.
--
-- Getest tegen een lokaal nagebouwd schema met de EXACTE live
-- discover_profiles()-definitie (0023_discover_profiles_availability_filter.sql,
-- door 0035's eigen live-inventarisatie bevestigd dat dit woordelijk de
-- productiedefinitie is, afgezien van de latere ALTER FUNCTION SET
-- search_path erboven). Veilig om vaker te draaien (tweede keer: geen
-- enkele rij heeft nog een kale dagcode, dus de UPDATE raakt 0 rijen).
--
-- ─────────────────────────────────────────────────────────────────────────
-- Controlequery (plak dit los in de SQL editor om te verifiëren):
-- ─────────────────────────────────────────────────────────────────────────
-- select count(*) as profielen_met_kale_dagcode
-- from public.profiles, unnest(availability_days) as v
-- where v = any (array['ma','di','wo','do','vr','za','zo']);
-- -- verwacht: 0
-- ─────────────────────────────────────────────────────────────────────────

begin;

do $$
declare
  v_legacy_codes text[] := array['ma','di','wo','do','vr','za','zo'];
  v_before_nonempty int;
  v_after_nonempty int;
begin
  select count(*) into v_before_nonempty from public.profiles
  where availability_days is not null and array_length(availability_days, 1) > 0;

  update public.profiles
  set availability_days = (
    select array_agg(distinct x)
    from (
      select unnest(
        case when d = any(v_legacy_codes)
          then array[d || '-ochtend', d || '-middag', d || '-avond']
          else array[d]
        end
      ) as x
      from unnest(availability_days) as d
    ) expanded
  )
  where availability_days && v_legacy_codes;

  select count(*) into v_after_nonempty from public.profiles
  where availability_days is not null and array_length(availability_days, 1) > 0;

  -- Zelfcontrole richting 1: geen kale dagcodes meer over.
  if exists (
    select 1 from public.profiles, unnest(availability_days) as v
    where v = any (v_legacy_codes)
  ) then
    raise exception 'Er staan na deze migratie nog kale dagcodes in profiles.availability_days.';
  end if;

  -- Zelfcontrole richting 2: niemand is zijn beschikbaarheid kwijtgeraakt.
  if v_after_nonempty < v_before_nonempty then
    raise exception 'Deze migratie liet profiel(en) hun beschikbaarheid verliezen (was %, nu %).', v_before_nonempty, v_after_nonempty;
  end if;

  raise notice 'availability_days: alle kale dagcodes omgezet naar dag+dagdeel (% profielen met beschikbaarheid, voor en na gelijk of hoger).', v_after_nonempty;
end $$;

commit;
