-- ============================================================================
-- AeroTrack — let staff read their own org's aircraft without a re-query
-- ----------------------------------------------------------------------------
-- Optional hardening. The client no longer depends on this, but the policy is
-- a trap for the next person who writes `.insert().select()` against aircraft.
--
-- `craft read` is can_read_aircraft(id), which calls craft_role_of(id), which
-- looks the aircraft up BY ID:
--
--   select 'manager' from public.aircraft a
--    where a.id = p_aircraft and public.is_org_staff(a.org_id)
--
-- Fine for an ordinary read. Not fine during INSERT … RETURNING: Postgres
-- applies the SELECT policy to the row being returned, the function re-queries
-- for a row the same command is still inserting, finds nothing, and the insert
-- fails as "new row violates row-level security policy for table aircraft" —
-- an error that names the wrong cause entirely.
--
-- Checking org_id straight off the row avoids the lookup. For the row being
-- inserted, org_id is right there; nothing has to be found first. Same
-- privileges as before — is_org_staff was already the first branch of
-- craft_role_of — just reached without the indirection.
--
-- Idempotent. Safe to re-run.
-- ============================================================================

drop policy if exists "craft read" on public.aircraft;
create policy "craft read" on public.aircraft for select
  using (public.is_org_staff(org_id) or public.can_read_aircraft(id));
