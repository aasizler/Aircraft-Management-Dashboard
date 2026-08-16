-- ============================================================================
-- AeroTrack — let shared users actually write
-- ----------------------------------------------------------------------------
-- `craft update` required can_manage_aircraft(), which is craft role 'manager'
-- and nothing else. But every operational record — squawks, inspections, oil,
-- flight log — still lives in the aircraft.data jsonb, so that one policy meant
-- an Owner or Pilot grant could not save anything at all. The UI offered them
-- the buttons, PostgREST filtered the update to zero rows, and RLS filters
-- rather than raising, so the app reported "synced" and the entry vanished on
-- the next load.
--
-- v1 was not this strict: its "Shared users can update owner fleet" policy let
-- any accepted share write the owner's fleet blob.
--
-- can_log_aircraft() is manager, owner and pilot — i.e. anyone holding an
-- accepted grant, which is the v1 behaviour. Per-key protection is not possible
-- while this data is one jsonb column; that needs the normalized tables
-- (aircraft_financials et al) and is tracked separately.
--
-- Idempotent. Safe to re-run.
-- ============================================================================

drop policy if exists "craft update" on public.aircraft;
create policy "craft update" on public.aircraft for update
  using (public.can_log_aircraft(id));
