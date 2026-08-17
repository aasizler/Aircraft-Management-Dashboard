-- ============================================================================
-- AeroTrack — a fleet grantee can see the fleet
-- ----------------------------------------------------------------------------
-- Share a fleet and the recipient gets its aircraft, but the hangar shows them
-- under "Active Aircraft" with no heading — because the hangar renders a
-- section per fleet it can READ, and `fleets read` was is_org_member(org_id).
-- Someone the fleet was shared with is not a member of the org that owns it,
-- so the fleet row was invisible and its aircraft fell through to ungrouped.
--
-- The alternative was denormalising the fleet's name onto every aircraft, which
-- then needs keeping in step on rename and on re-filing. Letting the grantee
-- read the one row they were given access to is less machinery and stays true.
--
-- Scope: the fleet row only — id, name, org_id. It does not grant anything
-- about the org or its other fleets.
--
-- Idempotent. Safe to re-run.
-- ============================================================================

-- A helper rather than an inlined EXISTS: the schema's own note says not to
-- inline these lookups into policies, and SECURITY DEFINER keeps the check off
-- the caller's view of aircraft_access.
create or replace function public.can_read_fleet(p_fleet uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1
      from public.aircraft_access ac
     where ac.fleet_id = p_fleet
       and ac.accepted
       and (ac.user_id = auth.uid()
            or lower(ac.invited_email) = lower(auth.jwt() ->> 'email'))
  );
$$;

revoke all on function public.can_read_fleet(uuid) from public, anon;
grant execute on function public.can_read_fleet(uuid) to authenticated;

drop policy if exists "fleets read" on public.fleets;
create policy "fleets read" on public.fleets for select
  using (public.is_org_member(org_id) or public.can_read_fleet(id));
