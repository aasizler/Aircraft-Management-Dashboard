-- ============================================================================
-- AeroTrack — fleets
-- ----------------------------------------------------------------------------
-- A fleet is a named group of aircraft inside an org, and a grant can target
-- one instead of a single aircraft. Share "Charter" with a new dispatcher and
-- they get every aircraft in it — including ones added to the fleet later,
-- which is the part per-aircraft grants can't do.
--
-- This is cheap for one reason: every permission in the app resolves through
-- craft_role_of(). One more branch there and fleet access reaches every policy
-- — aircraft, meters, flights, squawks, expenses, documents — with no policy
-- rewritten and no second way for access to be granted.
--
-- Precedence is most-specific-wins. An aircraft grant outranks a fleet grant,
-- so you can put someone on the whole charter fleet as Pilot and promote them
-- to Manager on one airframe. Priority order in the function is:
--   1 org staff → 2 aircraft grant → 3 fleet grant → 4 assignment
--
-- Idempotent. Safe to re-run.
-- ============================================================================

-- ── The fleet ───────────────────────────────────────────────────────────────
create table if not exists public.fleets (
  id         uuid primary key default gen_random_uuid(),
  org_id     uuid not null references public.orgs(id) on delete cascade,
  name       text not null,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);

create index if not exists fleets_org_idx on public.fleets (org_id);
-- Two fleets called "Charter" in one org is a mistake, not a use case.
create unique index if not exists fleets_org_name_unique
  on public.fleets (org_id, lower(name));

-- One fleet per aircraft; ungrouped aircraft keep a null and behave as before.
alter table public.aircraft
  add column if not exists fleet_id uuid references public.fleets(id) on delete set null;
create index if not exists aircraft_fleet_idx on public.aircraft (fleet_id);

alter table public.fleets enable row level security;

drop policy if exists "fleets read"  on public.fleets;
drop policy if exists "fleets write" on public.fleets;
create policy "fleets read"  on public.fleets for select using (public.is_org_member(org_id));
create policy "fleets write" on public.fleets for all
  using (public.is_org_staff(org_id)) with check (public.is_org_staff(org_id));


-- ── A grant may target a fleet instead of an aircraft ───────────────────────
alter table public.aircraft_access alter column aircraft_id drop not null;
alter table public.aircraft_access
  add column if not exists fleet_id uuid references public.fleets(id) on delete cascade;
-- Denormalized like aircraft_reg, and for the same reason: an unaccepted grant
-- can't read the fleet row, so the invitation has nothing to name itself with.
alter table public.aircraft_access add column if not exists fleet_name text;

do $$ begin
  alter table public.aircraft_access
    add constraint aircraft_access_target_ck
    check (num_nonnulls(aircraft_id, fleet_id) = 1);
exception when duplicate_object then null; end $$;

-- One grant per person per target. The existing pair covers aircraft; nulls are
-- distinct in a unique index, so fleet grants need their own.
create unique index if not exists aircraft_access_fleet_user_unique
  on public.aircraft_access (fleet_id, user_id) where fleet_id is not null;
create unique index if not exists aircraft_access_fleet_email_unique
  on public.aircraft_access (fleet_id, lower(invited_email)) where fleet_id is not null;


-- ── Stamping ────────────────────────────────────────────────────────────────
-- Extends the existing trigger rather than adding another. A fleet grant has no
-- aircraft to name, so it carries the fleet's name instead.
create or replace function public.stamp_access_details()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.aircraft_id is not null then
    select a.reg, a.type into new.aircraft_reg, new.aircraft_type
      from public.aircraft a where a.id = new.aircraft_id;
  elsif new.fleet_id is not null then
    select f.name into new.fleet_name
      from public.fleets f where f.id = new.fleet_id;
  end if;

  if auth.uid() is not null then
    if new.granted_by_email is null then
      select u.email into new.granted_by_email
        from auth.users u where u.id = auth.uid();
    end if;
    if new.granted_by_name is null then
      select nullif(trim(u.raw_user_meta_data ->> 'full_name'), '')
        into new.granted_by_name
        from auth.users u where u.id = auth.uid();
    end if;
  end if;

  return new;
end $$;

drop trigger if exists aircraft_access_details on public.aircraft_access;
create trigger aircraft_access_details
  before insert or update of aircraft_id, fleet_id on public.aircraft_access
  for each row execute function public.stamp_access_details();


-- ── The one place permissions resolve ───────────────────────────────────────
create or replace function public.craft_role_of(p_aircraft uuid)
returns craft_role language sql stable security definer set search_path = public as $$
  select r from (
    select 'manager'::craft_role as r, 1 as pri
      from public.aircraft a
     where a.id = p_aircraft and public.is_org_staff(a.org_id)
    union all
    -- Aircraft-specific grant. Outranks the fleet below it deliberately: an
    -- explicit grant on one airframe is the more specific statement.
    select ac.role, 2
      from public.aircraft_access ac
     where ac.aircraft_id = p_aircraft
       and ac.accepted
       and (ac.user_id = auth.uid()
            or lower(ac.invited_email) = lower(auth.jwt() ->> 'email'))
    union all
    -- Fleet grant: covers every aircraft currently in the fleet, and anything
    -- moved into it afterwards, with no re-granting.
    select ac.role, 3
      from public.aircraft_access ac
      join public.aircraft a on a.id = p_aircraft
     where ac.fleet_id is not null
       and ac.fleet_id = a.fleet_id
       and ac.accepted
       and (ac.user_id = auth.uid()
            or lower(ac.invited_email) = lower(auth.jwt() ->> 'email'))
    union all
    -- Assignments keep granting on the email match with no acceptance step:
    -- dispatch putting a contract pilot on a trip shouldn't wait on the pilot,
    -- and the grant expires with its date window.
    select 'pilot'::craft_role, 4
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


-- ── Claim / decline work unchanged on either target ─────────────────────────
-- Both already key off aircraft_access.id, so a fleet invitation is accepted
-- and declined by exactly the same path.
