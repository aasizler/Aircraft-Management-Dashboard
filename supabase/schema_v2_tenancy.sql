-- ============================================================================
-- AeroTrack — v2 Tenancy, Roles & Aircraft Normalization
-- ----------------------------------------------------------------------------
-- Run in the Supabase SQL editor. Idempotent — safe to re-run.
--
-- WHAT THIS REPLACES
--   v1 stored the entire fleet as ONE jsonb blob per user (`fleet.data`) and
--   implemented sharing by read-modify-write of the owner's blob. That is
--   last-write-wins across the whole fleet: two people editing concurrently
--   means one silently loses everything. v2 makes `aircraft` a first-class row
--   so concurrent edits touch disjoint rows.
--
-- TENANCY MODEL
--   The management company is the tenant (`orgs`). Owners and contract pilots
--   are users with scoped access INSIDE the org. A second management company is
--   simply a second org row.
--
-- WHAT IS DELIBERATELY *NOT* NORMALIZED YET
--   Aircraft detail that is manager-write-only (inspections, oil, insurance,
--   schedule, document metadata) stays in `aircraft.data` jsonb. It ports
--   cheaply from v1 and carries no permission risk, because no lower-privileged
--   role may write it at all.
--   flights + squawks ARE normalized now, because a contract pilot must be able
--   to write those WITHOUT being able to touch inspections — and RLS can gate a
--   table, but cannot gate one key inside a jsonb column.
-- ============================================================================


-- ── Enums ───────────────────────────────────────────────────────────────────
-- org_role  : standing inside the management company
-- craft_role: relationship to one specific aircraft
do $$ begin
  create type org_role as enum ('admin','manager','member');
exception when duplicate_object then null; end $$;

do $$ begin
  create type craft_role as enum ('owner','manager','pilot');
exception when duplicate_object then null; end $$;

-- Which physical time source a number came from. Aircraft differ: a Cirrus
-- carries flight time AND airframe total and uses them for DIFFERENT purposes;
-- a Bonanza may have a single timer that serves every purpose.
--   hobbs  — oil-pressure / squat-switch clock, real time while running
--   tach   — RPM-referenced, runs slower than real time at reduced power
--   flight — air time, wheels-up to wheels-down
--   total  — airframe total time
do $$ begin
  create type meter_kind as enum ('hobbs','tach','flight','total');
exception when duplicate_object then null; end $$;


-- ── orgs ────────────────────────────────────────────────────────────────────
create table if not exists public.orgs (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  slug        text unique,
  created_by  uuid references auth.users(id) on delete set null,
  created_at  timestamptz not null default now()
);

-- ── org_members ─────────────────────────────────────────────────────────────
-- Standing membership. `admin` = you + partner; `manager` = ops staff.
-- `member` is the floor for owners/pilots who need to authenticate but hold no
-- org-wide privileges — their reach comes from aircraft_access / assignments.
create table if not exists public.org_members (
  org_id     uuid not null references public.orgs(id) on delete cascade,
  user_id    uuid not null references auth.users(id) on delete cascade,
  role       org_role not null default 'member',
  email      text,
  full_name  text,
  created_at timestamptz not null default now(),
  primary key (org_id, user_id)
);

create index if not exists org_members_user_idx on public.org_members (user_id);

-- ── owner_entities ──────────────────────────────────────────────────────────
-- An aircraft owner is frequently an LLC or trust, not a person, and one owner
-- may hold several aircraft. Kept separate from users so ownership survives any
-- particular person's login.
create table if not exists public.owner_entities (
  id         uuid primary key default gen_random_uuid(),
  org_id     uuid not null references public.orgs(id) on delete cascade,
  name       text not null,
  contact_email text,
  contact_phone text,
  notes      text,
  created_at timestamptz not null default now()
);

create index if not exists owner_entities_org_idx on public.owner_entities (org_id);


-- ============================================================================
-- RLS HELPERS
-- ----------------------------------------------------------------------------
-- These MUST be SECURITY DEFINER. A policy on org_members that itself queries
-- org_members recurses infinitely; routing the lookup through a definer
-- function breaks the cycle. This is the single most common Supabase RLS
-- footgun — do not inline these lookups into policies.
-- ============================================================================

create or replace function public.is_org_member(p_org uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.org_members
    where org_id = p_org and user_id = auth.uid()
  );
$$;

create or replace function public.is_org_staff(p_org uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.org_members
    where org_id = p_org and user_id = auth.uid()
      and role in ('admin','manager')
  );
$$;

create or replace function public.is_org_admin(p_org uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.org_members
    where org_id = p_org and user_id = auth.uid() and role = 'admin'
  );
$$;


-- ============================================================================
-- AIRCRAFT
-- ============================================================================
create table if not exists public.aircraft (
  id            uuid primary key default gen_random_uuid(),
  org_id        uuid not null references public.orgs(id) on delete cascade,
  owner_entity_id uuid references public.owner_entities(id) on delete set null,

  -- Identity / the fields worth querying and indexing.
  reg           text not null,
  serial        text,
  type          text,
  airport       text,
  icao24        text,

  -- Which meter drives WHICH question, per aircraft. There is no universal
  -- answer: a Cirrus tracks inspections/SMOH on flight time but costs on
  -- airframe total, while a single-timer Bonanza points both at the same meter.
  -- v1 dodged this with Math.max(hobbs, tt) in the inspection math, which is
  -- wrong for any aircraft whose maintenance basis is the SMALLER number.
  maint_basis   meter_kind not null default 'hobbs',   -- inspections, SMOH, TBO
  cost_basis    meter_kind not null default 'hobbs',   -- billing, utilization, $/hr

  -- Everything else from the v1 aircraft object: inspections, oil, schedule,
  -- documents, insurance, monthlyHours, oilByMonth, oil-life fields.
  -- Manager-write-only, hence safe to leave denormalized for now.
  data          jsonb not null default '{}'::jsonb,

  sort_order    integer default 0,
  archived      boolean not null default false,
  legacy_id     text,                 -- v1 localStorage id, for the import map
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

create index if not exists aircraft_org_idx    on public.aircraft (org_id) where not archived;
create index if not exists aircraft_reg_idx    on public.aircraft (org_id, reg);
create index if not exists aircraft_legacy_idx on public.aircraft (legacy_id);

-- ── aircraft_meters ─────────────────────────────────────────────────────────
-- One row per time source the airframe actually carries. This is the single
-- source of truth for current hours — deliberately NOT columns on aircraft,
-- because the set of meters varies by airframe and hardcoding hobbs/tt is what
-- forced v1's max() hack.
--   Cirrus  → rows for 'flight' and 'total'; maint_basis='flight', cost_basis='total'
--   Bonanza → one row ('flight'); both bases point at it
create table if not exists public.aircraft_meters (
  aircraft_id uuid not null references public.aircraft(id) on delete cascade,
  kind        meter_kind not null,
  label       text,                    -- what the placard actually says
  current     numeric not null default 0,
  updated_at  timestamptz not null default now(),
  primary key (aircraft_id, kind)
);

-- Current value of whichever meter answers a given question.
create or replace function public.meter_value(p_aircraft uuid, p_kind meter_kind)
returns numeric language sql stable security definer set search_path = public as $$
  select coalesce((select current from public.aircraft_meters
                   where aircraft_id = p_aircraft and kind = p_kind), 0);
$$;

create or replace function public.maint_hours(p_aircraft uuid)
returns numeric language sql stable security definer set search_path = public as $$
  select public.meter_value(p_aircraft, (select maint_basis from public.aircraft where id = p_aircraft));
$$;

create or replace function public.cost_hours(p_aircraft uuid)
returns numeric language sql stable security definer set search_path = public as $$
  select public.meter_value(p_aircraft, (select cost_basis from public.aircraft where id = p_aircraft));
$$;

-- ── aircraft_access ─────────────────────────────────────────────────────────
-- Explicit, standing per-aircraft grants. Org staff do NOT need a row here —
-- they reach every aircraft in the org via is_org_staff(). This table is for
-- owners (see only their own tails) and any long-term named pilot.
create table if not exists public.aircraft_access (
  id          uuid primary key default gen_random_uuid(),
  org_id      uuid not null references public.orgs(id) on delete cascade,
  aircraft_id uuid not null references public.aircraft(id) on delete cascade,
  user_id     uuid references auth.users(id) on delete cascade,
  invited_email text,                 -- grant may precede the user signing up
  role        craft_role not null,
  created_by  uuid references auth.users(id) on delete set null,
  created_at  timestamptz not null default now(),
  unique (aircraft_id, user_id),
  unique (aircraft_id, invited_email)
);

create index if not exists aircraft_access_user_idx  on public.aircraft_access (user_id);
create index if not exists aircraft_access_email_idx on public.aircraft_access (lower(invited_email));

-- ── assignments ─────────────────────────────────────────────────────────────
-- One-off / contract pilot access, scoped to a date window. Access EXPIRES on
-- its own — nobody has to remember to revoke a trip that ended. This is the
-- difference between a management platform and a shared spreadsheet.
create table if not exists public.assignments (
  id          uuid primary key default gen_random_uuid(),
  org_id      uuid not null references public.orgs(id) on delete cascade,
  aircraft_id uuid not null references public.aircraft(id) on delete cascade,
  user_id     uuid references auth.users(id) on delete cascade,
  invited_email text,
  starts_at   timestamptz not null default now(),
  ends_at     timestamptz not null,
  purpose     text,
  created_by  uuid references auth.users(id) on delete set null,
  revoked_at  timestamptz,
  created_at  timestamptz not null default now()
);

create index if not exists assignments_lookup_idx
  on public.assignments (aircraft_id, user_id, ends_at desc);


-- ── Access resolution ───────────────────────────────────────────────────────
-- Effective role on an aircraft = the strongest of:
--   org staff  → 'manager'
--   explicit aircraft_access row
--   live assignment (now within window, not revoked) → 'pilot'
-- Email-based grants resolve once the invitee has an auth row with that email.
create or replace function public.craft_role_of(p_aircraft uuid)
returns craft_role language sql stable security definer set search_path = public as $$
  select r from (
    select 'manager'::craft_role as r, 1 as pri
      from public.aircraft a
     where a.id = p_aircraft and public.is_org_staff(a.org_id)
    union all
    select ac.role, 2
      from public.aircraft_access ac
     where ac.aircraft_id = p_aircraft
       and (ac.user_id = auth.uid()
            or lower(ac.invited_email) = lower(auth.jwt() ->> 'email'))
    union all
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

create or replace function public.can_read_aircraft(p_aircraft uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select public.craft_role_of(p_aircraft) is not null;
$$;

-- Full write on the aircraft record itself (incl. the jsonb detail) is
-- manager-only. Owners and pilots read it; neither edits inspections.
create or replace function public.can_manage_aircraft(p_aircraft uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select public.craft_role_of(p_aircraft) = 'manager';
$$;

-- Flights, squawks, meter readings: every current relationship may log.
-- Owners are included deliberately — owner-operators fly their own aircraft
-- under management, and blocking them from the flight log is wrong.
create or replace function public.can_log_aircraft(p_aircraft uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select public.craft_role_of(p_aircraft) in ('manager','owner','pilot');
$$;

-- Money. Managers run the books; owners see their own aircraft's numbers;
-- pilots never read financials at all (they may still SUBMIT a receipt — see
-- the expenses policies, which grant insert without select).
create or replace function public.can_see_money(p_aircraft uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select public.craft_role_of(p_aircraft) in ('manager','owner');
$$;


-- ============================================================================
-- OPERATIONAL RECORDS (normalized — role-sensitive writes)
-- ============================================================================
create table if not exists public.flights (
  id           uuid primary key default gen_random_uuid(),
  org_id       uuid not null references public.orgs(id) on delete cascade,
  aircraft_id  uuid not null references public.aircraft(id) on delete cascade,
  flight_date  date not null,
  dep_code     text,
  arr_code     text,
  -- Which meter these readings came off, so a flight logged against flight time
  -- is never silently compared to one logged against the airframe total.
  meter_kind   meter_kind,
  meter_out    numeric,
  meter_in     numeric,
  duration_h   numeric,
  pic          text,
  pax          integer,
  notes        text,
  billable     boolean default true,
  logged_by    uuid references auth.users(id) on delete set null,
  source       text default 'manual',   -- manual | adsb | import
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

create index if not exists flights_aircraft_idx on public.flights (aircraft_id, flight_date desc);

create table if not exists public.squawks (
  id           uuid primary key default gen_random_uuid(),
  org_id       uuid not null references public.orgs(id) on delete cascade,
  aircraft_id  uuid not null references public.aircraft(id) on delete cascade,
  title        text not null,
  detail       text,
  severity     text default 'normal',   -- normal | grounding
  status       text default 'open',     -- open | resolved
  reported_by  uuid references auth.users(id) on delete set null,
  reported_at  timestamptz not null default now(),
  resolved_by  uuid references auth.users(id) on delete set null,
  resolved_at  timestamptz,
  resolution   text
);

create index if not exists squawks_open_idx on public.squawks (aircraft_id, status);


-- ============================================================================
-- FINANCIALS (separate table, NOT a column on aircraft)
-- ----------------------------------------------------------------------------
-- RLS is row-level, not column-level: if insurance premiums and billing rates
-- lived in aircraft.data, any role that can read the aircraft could read them.
-- Splitting them into their own row is the only way to let a contract pilot
-- read airworthiness status while seeing nothing about money.
-- ============================================================================
create table if not exists public.aircraft_financials (
  aircraft_id   uuid primary key references public.aircraft(id) on delete cascade,
  org_id        uuid not null references public.orgs(id) on delete cascade,
  insurance     jsonb not null default '{}'::jsonb,  -- carrier, policy #, premium, hull/liability
  billing       jsonb not null default '{}'::jsonb,  -- hourly rate, mgmt fee, fuel surcharge
  notes         text,
  updated_at    timestamptz not null default now()
);

-- ── expenses ────────────────────────────────────────────────────────────────
-- A pilot can submit a receipt but cannot read the ledger. That asymmetry is
-- the whole point: `insert` is granted, `select` is scoped to submitter-only.
create table if not exists public.expenses (
  id            uuid primary key default gen_random_uuid(),
  org_id        uuid not null references public.orgs(id) on delete cascade,
  aircraft_id   uuid not null references public.aircraft(id) on delete cascade,
  spent_on      date not null default current_date,
  category      text,                    -- fuel | maintenance | landing | catering | other
  amount        numeric,
  vendor        text,
  memo          text,
  receipt_path  text,                    -- Supabase Storage key
  -- Nullable on purpose: the FK sets it null when the submitter's account is
  -- deleted, and `not null` here made that impossible — Postgres refused the
  -- user deletion outright rather than forgetting who filed the expense.
  submitted_by  uuid default auth.uid() references auth.users(id) on delete set null,
  status        text not null default 'submitted',  -- submitted | approved | rejected
  reviewed_by   uuid references auth.users(id) on delete set null,
  reviewed_at   timestamptz,
  created_at    timestamptz not null default now()
);

create index if not exists expenses_aircraft_idx on public.expenses (aircraft_id, spent_on desc);
create index if not exists expenses_submitter_idx on public.expenses (submitted_by);


-- ============================================================================
-- METER READINGS — photo-of-the-Hobbs capture
-- ----------------------------------------------------------------------------
-- A vision model parses a photo of the Hobbs / tach into numbers. Those numbers
-- feed SMOH and inspection intervals, i.e. airworthiness math, so:
--   * the parsed value is NEVER committed silently — it lands here as
--     `pending` and a human confirms it;
--   * the source image is retained as the evidence trail for the maintenance
--     record;
--   * application to aircraft hours goes through apply_meter_reading(), which
--     re-checks monotonicity and plausibility server-side.
-- The classic failure is a decimal slip (1234.5 read as 12345) or a drum caught
-- mid-roll; both are caught by the delta guard rather than by trusting the model.
-- ============================================================================
create table if not exists public.meter_readings (
  id             uuid primary key default gen_random_uuid(),
  org_id         uuid not null references public.orgs(id) on delete cascade,
  aircraft_id    uuid not null references public.aircraft(id) on delete cascade,
  captured_at    timestamptz not null default now(),
  image_path     text,                   -- Supabase Storage key — the evidence

  -- Keyed by meter_kind, because one photo may show one meter or several and
  -- the set differs per airframe:  {"flight": 1234.5, "total": 1402.3}
  -- What the model returned, untouched.
  values_raw     jsonb not null default '{}'::jsonb,
  confidence     numeric,                -- 0..1 self-reported
  model_notes    text,                   -- glare, partial roll, ambiguous decimal
  model_version  text,

  -- What the human accepted (may differ — corrections are the training signal).
  values_final   jsonb,

  status         text not null default 'pending',   -- pending | confirmed | rejected
  flagged        boolean not null default false,    -- failed a sanity guard
  flag_reason    text,

  -- Nullable for the same reason as expenses.submitted_by: `not null` plus
  -- `on delete set null` is self-contradictory and blocks deleting the user.
  submitted_by   uuid default auth.uid() references auth.users(id) on delete set null,
  confirmed_by   uuid references auth.users(id) on delete set null,
  confirmed_at   timestamptz,
  flight_id      uuid references public.flights(id) on delete set null,
  created_at     timestamptz not null default now()
);

create index if not exists meter_readings_craft_idx on public.meter_readings (aircraft_id, captured_at desc);
create index if not exists meter_readings_pending_idx on public.meter_readings (org_id, status) where status = 'pending';

-- Commit a confirmed reading to the aircraft's hours.
-- SECURITY DEFINER so a pilot/owner can advance hours through this ONE narrow,
-- validated path while aircraft UPDATE stays manager-only for everything else.
-- NOTE: the live definition of this function is maintained in
-- migrate_meter_confirm_and_realtime.sql, which supersedes the original >50hr
-- rejection. Kept here so a fresh project gets the current behaviour:
--   * first reading for a meter is the baseline and is accepted as-is
--   * an advance over meter_confirm_threshold() (10 hrs) is NOT rejected — it
--     returns needs_confirmation and the client asks the user to vouch for it
--   * a reading below the current value is still refused
create or replace function public.meter_confirm_threshold()
returns numeric language sql immutable as $$ select 10::numeric $$;

create or replace function public.apply_meter_reading(p_reading uuid, p_confirm boolean)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  r public.meter_readings;
  k text; v numeric; cur numeric; delta numeric;
  applied  jsonb := '{}'::jsonb;
  needs    jsonb := '[]'::jsonb;
  threshold numeric := public.meter_confirm_threshold();
begin
  select * into r from public.meter_readings where id = p_reading;
  if not found then raise exception 'reading not found'; end if;
  if not public.can_log_aircraft(r.aircraft_id) then raise exception 'not permitted'; end if;
  if r.values_final is null or r.values_final = '{}'::jsonb then
    raise exception 'no confirmed values';
  end if;

  for k, v in select key, value::text::numeric from jsonb_each(r.values_final) loop
    cur := public.meter_value(r.aircraft_id, k::meter_kind);

    if cur is null or cur = 0 then
      applied := applied || jsonb_build_object(k, jsonb_build_object('from', cur, 'to', v, 'first', true));
      continue;
    end if;

    delta := v - cur;

    if delta < 0 then
      return jsonb_build_object('ok', false, 'reason', 'below_current',
                                'meter', k, 'current', cur, 'read', v);
    end if;

    if delta > threshold and not p_confirm then
      needs := needs || jsonb_build_array(
        jsonb_build_object('meter', k, 'current', cur, 'read', v, 'delta', delta)
      );
    end if;

    applied := applied || jsonb_build_object(k, jsonb_build_object('from', cur, 'to', v));
  end loop;

  if jsonb_array_length(needs) > 0 then
    update public.meter_readings
       set flagged = true, flag_reason = 'large_delta'
     where id = p_reading;
    return jsonb_build_object('ok', false, 'reason', 'needs_confirmation',
                              'threshold', threshold, 'meters', needs);
  end if;

  for k, v in select key, value::text::numeric from jsonb_each(r.values_final) loop
    insert into public.aircraft_meters (aircraft_id, kind, current, updated_at)
    values (r.aircraft_id, k::meter_kind, v, now())
    on conflict (aircraft_id, kind)
      do update set current = excluded.current, updated_at = now();
  end loop;

  update public.meter_readings
     set status = 'confirmed', confirmed_by = auth.uid(), confirmed_at = now(),
         flagged = flagged or p_confirm,
         flag_reason = case when p_confirm then coalesce(flag_reason, 'large_delta_confirmed')
                            else flag_reason end
   where id = p_reading;

  return jsonb_build_object('ok', true, 'applied', applied);
end $$;

create or replace function public.apply_meter_reading(p_reading uuid)
returns jsonb language sql security definer set search_path = public as $$
  select public.apply_meter_reading(p_reading, false)
$$;


-- ============================================================================
-- RE-KEY THE FLIGHT MONITOR TABLES
-- ----------------------------------------------------------------------------
-- flight_history/monitored_aircraft were keyed to user_id + text aircraft_id.
-- A flight belongs to the AIRCRAFT, not to whichever browser observed it.
-- Both tables are empty today, so this is free right now and expensive later.
-- ============================================================================
alter table public.flight_history   add column if not exists org_id      uuid references public.orgs(id) on delete cascade;
alter table public.flight_history   add column if not exists craft_id    uuid references public.aircraft(id) on delete cascade;
alter table public.monitored_aircraft add column if not exists org_id    uuid references public.orgs(id) on delete cascade;
alter table public.monitored_aircraft add column if not exists craft_id  uuid references public.aircraft(id) on delete cascade;

create index if not exists flight_history_craft_idx on public.flight_history (craft_id, arr_ts desc);

-- New dedupe key on the aircraft, replacing the per-user one.
create unique index if not exists flight_history_craft_dep_uniq
  on public.flight_history (craft_id, dep_ts) where craft_id is not null;


-- ============================================================================
-- ROW LEVEL SECURITY
-- ============================================================================
alter table public.orgs             enable row level security;
alter table public.org_members      enable row level security;
alter table public.owner_entities   enable row level security;
alter table public.aircraft         enable row level security;
alter table public.aircraft_meters  enable row level security;
alter table public.aircraft_access  enable row level security;
alter table public.assignments      enable row level security;
alter table public.flights          enable row level security;
alter table public.squawks          enable row level security;
alter table public.aircraft_financials enable row level security;
alter table public.expenses         enable row level security;
alter table public.meter_readings   enable row level security;

-- orgs
drop policy if exists "org read"   on public.orgs;
drop policy if exists "org update" on public.orgs;
drop policy if exists "org insert" on public.orgs;
create policy "org read"   on public.orgs for select using (public.is_org_member(id));
create policy "org update" on public.orgs for update using (public.is_org_admin(id));
create policy "org insert" on public.orgs for insert with check (auth.uid() = created_by);

-- org_members: everyone in the org can see the roster; only admins mutate it.
drop policy if exists "members read"  on public.org_members;
drop policy if exists "members write" on public.org_members;
drop policy if exists "members edit"  on public.org_members;
drop policy if exists "members del"   on public.org_members;
create policy "members read"  on public.org_members for select using (public.is_org_member(org_id));
create policy "members write" on public.org_members for insert with check (public.is_org_admin(org_id));
create policy "members edit"  on public.org_members for update using (public.is_org_admin(org_id));
create policy "members del"   on public.org_members for delete using (public.is_org_admin(org_id));

-- owner_entities: staff only. Owners do not browse each other.
drop policy if exists "owners read"  on public.owner_entities;
drop policy if exists "owners write" on public.owner_entities;
create policy "owners read"  on public.owner_entities for select using (public.is_org_staff(org_id));
create policy "owners write" on public.owner_entities for all    using (public.is_org_staff(org_id)) with check (public.is_org_staff(org_id));

-- aircraft: read if you have ANY relationship; write only as manager.
drop policy if exists "craft read"   on public.aircraft;
drop policy if exists "craft insert" on public.aircraft;
drop policy if exists "craft update" on public.aircraft;
drop policy if exists "craft delete" on public.aircraft;
create policy "craft read"   on public.aircraft for select using (public.can_read_aircraft(id));
create policy "craft insert" on public.aircraft for insert with check (public.is_org_staff(org_id));
create policy "craft update" on public.aircraft for update using (public.can_manage_aircraft(id));
create policy "craft delete" on public.aircraft for delete using (public.is_org_staff(org_id));

-- aircraft_meters: readable by anyone who can read the aircraft (a pilot must
-- be able to see current hours). Direct writes are manager-only — everyone else
-- advances hours through apply_meter_reading(), which validates first.
drop policy if exists "meters read"  on public.aircraft_meters;
drop policy if exists "meters write" on public.aircraft_meters;
create policy "meters read"  on public.aircraft_meters for select using (public.can_read_aircraft(aircraft_id));
create policy "meters write" on public.aircraft_meters for all
  using (public.can_manage_aircraft(aircraft_id)) with check (public.can_manage_aircraft(aircraft_id));

-- aircraft_access / assignments: staff administer; you may see your own grant.
drop policy if exists "access read"  on public.aircraft_access;
drop policy if exists "access write" on public.aircraft_access;
create policy "access read"  on public.aircraft_access for select
  using (public.is_org_staff(org_id)
         or user_id = auth.uid()
         or lower(invited_email) = lower(auth.jwt() ->> 'email'));
create policy "access write" on public.aircraft_access for all
  using (public.is_org_staff(org_id)) with check (public.is_org_staff(org_id));

drop policy if exists "asg read"  on public.assignments;
drop policy if exists "asg write" on public.assignments;
create policy "asg read"  on public.assignments for select
  using (public.is_org_staff(org_id)
         or user_id = auth.uid()
         or lower(invited_email) = lower(auth.jwt() ->> 'email'));
create policy "asg write" on public.assignments for all
  using (public.is_org_staff(org_id)) with check (public.is_org_staff(org_id));

-- flights: read with any relationship; a pilot may log and may edit only what
-- they logged. Managers edit anything.
drop policy if exists "flights read"   on public.flights;
drop policy if exists "flights insert" on public.flights;
drop policy if exists "flights update" on public.flights;
drop policy if exists "flights delete" on public.flights;
create policy "flights read"   on public.flights for select using (public.can_read_aircraft(aircraft_id));
create policy "flights insert" on public.flights for insert with check (public.can_log_aircraft(aircraft_id));
create policy "flights update" on public.flights for update
  using (public.can_manage_aircraft(aircraft_id)
         or (logged_by = auth.uid() and public.can_log_aircraft(aircraft_id)));
create policy "flights delete" on public.flights for delete using (public.can_manage_aircraft(aircraft_id));

-- squawks: anyone with a relationship may REPORT one (an owner noticing a
-- problem matters); only managers resolve.
drop policy if exists "squawks read"   on public.squawks;
drop policy if exists "squawks insert" on public.squawks;
drop policy if exists "squawks update" on public.squawks;
create policy "squawks read"   on public.squawks for select using (public.can_read_aircraft(aircraft_id));
create policy "squawks insert" on public.squawks for insert with check (public.can_read_aircraft(aircraft_id));
create policy "squawks update" on public.squawks for update using (public.can_manage_aircraft(aircraft_id));

-- aircraft_financials: managers and owners only. A pilot cannot read the row
-- at all, which is why insurance/billing had to leave the aircraft blob.
drop policy if exists "fin read"  on public.aircraft_financials;
drop policy if exists "fin write" on public.aircraft_financials;
create policy "fin read"  on public.aircraft_financials for select using (public.can_see_money(aircraft_id));
create policy "fin write" on public.aircraft_financials for all
  using (public.can_manage_aircraft(aircraft_id)) with check (public.can_manage_aircraft(aircraft_id));

-- expenses: the asymmetric one. A pilot may INSERT a receipt for any aircraft
-- they're currently on, but SELECT is limited to their own submissions — they
-- never see the ledger. Owners see their aircraft's expenses; managers review.
drop policy if exists "exp read"   on public.expenses;
drop policy if exists "exp insert" on public.expenses;
drop policy if exists "exp update" on public.expenses;
drop policy if exists "exp delete" on public.expenses;
create policy "exp read" on public.expenses for select
  using (public.can_see_money(aircraft_id) or submitted_by = auth.uid());
create policy "exp insert" on public.expenses for insert
  with check (public.can_log_aircraft(aircraft_id) and submitted_by = auth.uid());
create policy "exp update" on public.expenses for update
  using (public.can_manage_aircraft(aircraft_id)
         or (submitted_by = auth.uid() and status = 'submitted'));
create policy "exp delete" on public.expenses for delete using (public.can_manage_aircraft(aircraft_id));

-- meter_readings: anyone who can log may photograph the meter and confirm their
-- own capture; managers see and correct everything.
drop policy if exists "meter read"   on public.meter_readings;
drop policy if exists "meter insert" on public.meter_readings;
drop policy if exists "meter update" on public.meter_readings;
create policy "meter read" on public.meter_readings for select using (public.can_read_aircraft(aircraft_id));
create policy "meter insert" on public.meter_readings for insert
  with check (public.can_log_aircraft(aircraft_id) and submitted_by = auth.uid());
create policy "meter update" on public.meter_readings for update
  using (public.can_manage_aircraft(aircraft_id)
         or (submitted_by = auth.uid() and status = 'pending'));

-- flight_history: follow the aircraft once re-keyed. The monitor writes with
-- the service role and bypasses these entirely.
drop policy if exists "own flights read"   on public.flight_history;
drop policy if exists "own flights insert" on public.flight_history;
drop policy if exists "own flights delete" on public.flight_history;
create policy "hist read"   on public.flight_history for select
  using (craft_id is not null and public.can_read_aircraft(craft_id));
create policy "hist insert" on public.flight_history for insert
  with check (craft_id is not null and public.can_log_aircraft(craft_id));
create policy "hist delete" on public.flight_history for delete
  using (craft_id is not null and public.can_manage_aircraft(craft_id));


-- ============================================================================
-- updated_at triggers
-- ============================================================================
create or replace function public.touch_updated_at()
returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end $$;

drop trigger if exists aircraft_touch on public.aircraft;
create trigger aircraft_touch before update on public.aircraft
  for each row execute function public.touch_updated_at();

drop trigger if exists flights_touch on public.flights;
create trigger flights_touch before update on public.flights
  for each row execute function public.touch_updated_at();


-- ============================================================================
-- BOOTSTRAP — run once, with your own auth uid.
-- ----------------------------------------------------------------------------
-- select id, email from auth.users;      -- grab your uid
--
-- insert into public.orgs (name, slug, created_by)
--   values ('<Management Co>', '<slug>', '<your-uid>')
--   returning id;
--
-- insert into public.org_members (org_id, user_id, role, email)
--   values ('<org-id>', '<your-uid>', 'admin', '<your-email>');
--
-- Aircraft are then imported from the v1 fleet blob by the migration script,
-- which maps each blob entry's `id` into aircraft.legacy_id so existing
-- localStorage references keep resolving during the transition.
-- ============================================================================
