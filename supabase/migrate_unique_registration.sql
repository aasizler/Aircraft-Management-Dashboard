-- ============================================================================
-- AeroTrack — one registration per org
-- ----------------------------------------------------------------------------
-- aircraft_reg_idx is (org_id, reg) and NOT unique, so the same tail number
-- could be added to an org twice. That is always a mistake, and it isn't only
-- cosmetic: ADS-B is keyed by registration — useFleetAirborne maps over reg and
-- each tile reads airborne[reg] — so two rows sharing a tail both light up LIVE
-- for a single flight, and the live banner attributes one aircraft to both.
--
-- Case-insensitive, since n137bf and N137BF are the same aeroplane. Archived
-- rows are excluded so retiring an aircraft doesn't block re-adding it later.
--
-- Cross-org duplicates are deliberately still allowed: two operators can
-- legitimately hold records for the same airframe, and one org cannot be
-- prevented from naming an aircraft that exists in another. The hangar
-- disambiguates those by showing whose they are.
--
-- Run the check below FIRST — creating the index fails if duplicates exist.
-- ============================================================================

-- ── Check before you run the rest ───────────────────────────────────────────
--   select org_id, upper(reg) as reg, count(*), array_agg(id) as ids
--     from public.aircraft
--    where not archived
--    group by org_id, upper(reg)
--   having count(*) > 1;
--
-- Any rows returned must be merged or archived before the index will build.

create unique index if not exists aircraft_reg_unique
  on public.aircraft (org_id, upper(reg))
  where not archived;
