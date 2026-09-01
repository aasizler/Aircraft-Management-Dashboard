-- ============================================================================
-- AeroTrack — a fleet's manager can share that fleet
-- ----------------------------------------------------------------------------
-- Sharing a fleet was org-staff-only: `access write` is is_org_staff(org_id),
-- so someone the fleet was GRANTED to could never pass it on, however senior
-- their grant. The hangar hid the fleet ⋮ from them, which at least matched
-- what the database would have done anyway.
--
-- What "senior enough" means here is the grant that already carries
-- manage_access in lib/permissions.ts — the `manager` grant (v1's owner
-- permission set). An `owner` grant deliberately does NOT get this: it sees the
-- money and edits the records, but the roster is not its business. Handing the
-- roster to a role that cannot manage access on a single aircraft would be a
-- privilege expansion, not a rename.
--
-- Scope is deliberately narrow: it authorises rows FOR THAT FLEET only. It
-- confers nothing over the org, its other fleets, or aircraft-level grants.
-- Renaming and deleting the fleet stay org-staff-only — a grantee may pass a
-- fleet on, not rewrite or destroy somebody else's.
--
-- Idempotent. Safe to re-run.
-- ============================================================================

-- SECURITY DEFINER, like can_read_fleet: the check reads aircraft_access, and
-- this is used INSIDE aircraft_access's own policy. Definer rights mean the
-- lookup does not re-enter RLS and recurse.
create or replace function public.can_share_fleet(p_fleet uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select p_fleet is not null and (
    exists (
      select 1 from public.fleets f
       where f.id = p_fleet and public.is_org_staff(f.org_id)
    )
    or exists (
      select 1 from public.aircraft_access ac
       where ac.fleet_id = p_fleet
         and ac.accepted
         and ac.role = 'manager'
         and (ac.user_id = auth.uid()
              or lower(ac.invited_email) = lower(auth.jwt() ->> 'email'))
    )
  );
$$;

revoke all on function public.can_share_fleet(uuid) from public, anon;
grant execute on function public.can_share_fleet(uuid) to authenticated;

-- The row must still belong to the fleet being shared; can_share_fleet(NULL)
-- is false, so aircraft-level grants are untouched by this clause and remain
-- org-staff-only.
drop policy if exists "access write" on public.aircraft_access;
create policy "access write" on public.aircraft_access for all
  using      (public.is_org_staff(org_id) or public.can_share_fleet(fleet_id))
  with check (public.is_org_staff(org_id) or public.can_share_fleet(fleet_id));
