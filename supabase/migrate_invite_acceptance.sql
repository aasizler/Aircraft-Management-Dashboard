-- ============================================================================
-- AeroTrack — invitations must be accepted before they grant access
-- ----------------------------------------------------------------------------
-- Restores v1's behaviour, which was correct and got dropped in the port.
--
-- v1 kept an `accepted` boolean on aircraft_shares. pullSharedAircraft() only
-- pulled shares with accepted = true, and the fleet RLS policy required it as
-- well, so an invitation conferred nothing until the invitee agreed to it.
--
-- v2 lost that. craft_role_of() matches a bare `invited_email`, so signing in
-- with an invited address grants full access immediately and the Accept button
-- is decoration.
--
-- Worse, the only write policy on aircraft_access is is_org_staff(), so an
-- invitee's own accept and decline match zero rows. RLS filters rows rather
-- than raising, so both report success and do nothing — "Invite declined"
-- while the person keeps full access.
--
-- Idempotent. Safe to re-run.
-- ============================================================================

-- ── 1. The acceptance gate ──────────────────────────────────────────────────
-- Deliberately a separate column rather than reusing `user_id is null`.
-- user_id answers "which account is this", accepted answers "have they agreed";
-- v1 kept them apart (shared_user_id vs accepted) and conflating them means a
-- granter can't tell a claimed-but-unanswered invite from an unclaimed one.
alter table public.aircraft_access
  add column if not exists accepted boolean not null default false;

-- NOT backfilled on purpose. An outstanding invite loses access until accepted
-- — that is the point — and the invitee gets the pending banner immediately.
-- Org staff are unaffected: they reach aircraft through is_org_staff(), never
-- through aircraft_access.


-- ── 2. Denormalized aircraft identity ───────────────────────────────────────
-- An unaccepted invite can no longer read the aircraft row, so the banner and
-- modal cannot resolve a registration. v1 carried aircraft_reg and
-- aircraft_type on the share row for exactly this reason. granted_by_email
-- replaces v1's get_user_display_name() RPC, which the cleanup dropped.
alter table public.aircraft_access add column if not exists aircraft_reg    text;
alter table public.aircraft_access add column if not exists aircraft_type   text;
alter table public.aircraft_access add column if not exists granted_by_email text;

update public.aircraft_access ac
   set aircraft_reg  = a.reg,
       aircraft_type = a.type
  from public.aircraft a
 where a.id = ac.aircraft_id
   and (ac.aircraft_reg is distinct from a.reg
     or ac.aircraft_type is distinct from a.type);

-- Stamped by trigger so every insert path is covered, not just the one in the
-- Manage Access modal.
create or replace function public.stamp_access_details()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  select a.reg, a.type into new.aircraft_reg, new.aircraft_type
    from public.aircraft a where a.id = new.aircraft_id;

  if new.granted_by_email is null and auth.uid() is not null then
    select u.email into new.granted_by_email
      from auth.users u where u.id = auth.uid();
  end if;

  return new;
end $$;

drop trigger if exists aircraft_access_details on public.aircraft_access;
create trigger aircraft_access_details
  before insert or update of aircraft_id on public.aircraft_access
  for each row execute function public.stamp_access_details();


-- ── 3. Only an ACCEPTED grant confers access ────────────────────────────────
create or replace function public.craft_role_of(p_aircraft uuid)
returns craft_role language sql stable security definer set search_path = public as $$
  select r from (
    select 'manager'::craft_role as r, 1 as pri
      from public.aircraft a
     where a.id = p_aircraft and public.is_org_staff(a.org_id)
    union all
    -- The email match stays (v1 matched on invited_email too, for grants made
    -- before the person signed up) — `accepted` is what actually gates it.
    select ac.role, 2
      from public.aircraft_access ac
     where ac.aircraft_id = p_aircraft
       and ac.accepted
       and (ac.user_id = auth.uid()
            or lower(ac.invited_email) = lower(auth.jwt() ->> 'email'))
    union all
    -- Assignments keep granting on the email match with no acceptance step:
    -- dispatch putting a contract pilot on a trip shouldn't wait on the pilot,
    -- and the grant expires on its own date window.
    select 'pilot'::craft_role, 3
      from public.assignments asg
     where asg.aircraft_id = p_aircraft
       and (asg.user_id = auth.uid()
            or lower(asg.invited_email) = lower(auth.jwt() ->> 'email'))
       and asg.revoked_at is null
       and now() between asg.starts_at and asg.ends_at
  ) t
  order by pri
  limit 1;
$$;


-- ── 4. Accept / decline ─────────────────────────────────────────────────────
-- Routed through SECURITY DEFINER rather than an invitee-scoped UPDATE policy.
-- A policy narrow enough to let them stamp their own row would also let them
-- rewrite `role` in the same statement — WITH CHECK can pin user_id, but
-- nothing stops `set role = 'manager'` alongside it. A function touches only
-- the columns it means to.
--
-- Both return false when nothing matched, so the UI can stop reporting success
-- for a no-op.

create or replace function public.claim_aircraft_access(p_access uuid)
returns boolean language plpgsql security definer set search_path = public as $$
declare
  v_email text := lower(auth.jwt() ->> 'email');
begin
  if auth.uid() is null then return false; end if;
  -- v1 ran resolveEmailInvites() before accepting, to stamp shared_user_id
  -- from the email. Same thing, in one statement.
  update public.aircraft_access
     set accepted = true,
         user_id  = coalesce(user_id, auth.uid())
   where id = p_access
     and not accepted
     and (user_id = auth.uid()
          or (v_email is not null and lower(invited_email) = v_email));
  return found;
end $$;

create or replace function public.decline_aircraft_access(p_access uuid)
returns boolean language plpgsql security definer set search_path = public as $$
declare
  v_email text := lower(auth.jwt() ->> 'email');
begin
  if auth.uid() is null then return false; end if;
  delete from public.aircraft_access
   where id = p_access
     and (user_id = auth.uid()
          or (v_email is not null and lower(invited_email) = v_email));
  return found;
end $$;

revoke all on function public.claim_aircraft_access(uuid)   from public;
revoke all on function public.decline_aircraft_access(uuid) from public;
grant execute on function public.claim_aircraft_access(uuid)   to authenticated;
grant execute on function public.decline_aircraft_access(uuid) to authenticated;
