-- ============================================================================
-- AeroTrack — move insurance out of aircraft.data
-- ----------------------------------------------------------------------------
-- Premiums, hull values, liability limits and named pilots live in the
-- aircraft.data jsonb. RLS gates rows, not keys inside them, so `craft read`
-- (can_read_aircraft) hands the whole blob to anyone with ANY relationship to
-- the aircraft — a Pilot grant included. Hiding the Insurance tab from those
-- roles is a UI gate over data the API still serves.
--
-- aircraft_financials already exists for this, with the right policies and
-- nothing in it:
--   fin read  → can_see_money()      manager + owner, never pilot
--   fin write → can_manage_aircraft() manager only
--
-- So this moves the data and then removes it from the blob. The second half is
-- the point: copying alone would leave the readable copy in place.
--
-- Idempotent. Safe to re-run — the insert skips aircraft already moved, and the
-- strip only touches rows that still carry the key.
-- ============================================================================

-- ── 1. Copy across ──────────────────────────────────────────────────────────
insert into public.aircraft_financials (aircraft_id, org_id, insurance)
select a.id, a.org_id, a.data -> 'insurance'
  from public.aircraft a
 where a.data ? 'insurance'
   and jsonb_typeof(a.data -> 'insurance') = 'object'
on conflict (aircraft_id) do update
  -- Only fill a row that has nothing yet; never clobber financials already
  -- edited through the new table with a stale copy from the blob.
  set insurance = case
        when public.aircraft_financials.insurance = '{}'::jsonb
          then excluded.insurance
        else public.aircraft_financials.insurance
      end;

-- ── 2. Verify before destroying ─────────────────────────────────────────────
-- Refuses to strip anything unless every aircraft carrying an insurance key
-- has a financials row to match. Better to fail loudly than half-move.
do $$
declare
  v_missing int;
begin
  select count(*) into v_missing
    from public.aircraft a
   where a.data ? 'insurance'
     and jsonb_typeof(a.data -> 'insurance') = 'object'
     and not exists (
       select 1 from public.aircraft_financials f where f.aircraft_id = a.id
     );
  if v_missing > 0 then
    raise exception 'aborting: % aircraft still lack a financials row', v_missing;
  end if;
end $$;

-- ── 3. Remove the readable copy ─────────────────────────────────────────────
update public.aircraft
   set data = data - 'insurance'
 where data ? 'insurance';
