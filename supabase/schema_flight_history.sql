-- ============================================================================
-- AeroTrack — Background Flight Monitor + Flight History
-- ----------------------------------------------------------------------------
-- Run this in the Supabase SQL editor (idempotent — safe to re-run).
--
-- Design notes:
--  * flight_history splits lightweight metadata from the heavy `track` blob.
--    NEVER select `track` when listing — it is TOAST-compressed and only
--    fetched on demand when a route is replayed on the Utilization map.
--  * monitored_aircraft is the poll list for the background Edge Function plus a
--    per-aircraft `last_arr_ts` watermark that makes the monitor idempotent and
--    cheap (only legs newer than the watermark are inserted).
--  * The Edge Function writes with the service-role key (bypasses RLS). The
--    authenticated browser also inserts live-detected flights; the unique
--    constraint dedupes the two paths.
-- ============================================================================

-- Needed for the cron trigger + outbound http from Postgres.
create extension if not exists pg_cron;
create extension if not exists pg_net;

-- ── flight_history ──────────────────────────────────────────────────────────
create table if not exists public.flight_history (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null references auth.users(id) on delete cascade,
  aircraft_id  text not null,
  reg          text not null,
  icao24       text,
  dep_code     text,
  arr_code     text,
  dep_lat      double precision,
  dep_lon      double precision,
  arr_lat      double precision,
  arr_lon      double precision,
  dep_ts       timestamptz,
  arr_ts       timestamptz,
  duration_h   numeric,
  max_alt      integer,
  distance_nm  numeric,
  point_count  integer,
  track        jsonb,               -- [{lat,lon,alt,ts}] decimated; lazy-selected only
  source       text,
  created_at   timestamptz not null default now(),
  -- Idempotency: the same flight is never inserted twice, regardless of which
  -- path (background monitor or live client) sees it first.
  unique (user_id, aircraft_id, dep_ts)
);

-- Fast "latest flights per aircraft" listing without touching the track blob.
create index if not exists flight_history_latest_idx
  on public.flight_history (user_id, aircraft_id, arr_ts desc);

alter table public.flight_history enable row level security;

drop policy if exists "own flights read"   on public.flight_history;
drop policy if exists "own flights insert"  on public.flight_history;
drop policy if exists "own flights delete"  on public.flight_history;

create policy "own flights read"
  on public.flight_history for select
  using (auth.uid() = user_id);

-- Client inserts live-detected flights for itself; monitor uses service role.
create policy "own flights insert"
  on public.flight_history for insert
  with check (auth.uid() = user_id);

create policy "own flights delete"
  on public.flight_history for delete
  using (auth.uid() = user_id);

-- ── monitored_aircraft ──────────────────────────────────────────────────────
create table if not exists public.monitored_aircraft (
  user_id      uuid not null references auth.users(id) on delete cascade,
  aircraft_id  text not null,
  reg          text not null,
  icao24       text,
  last_arr_ts  timestamptz,         -- watermark: newest flight already saved
  last_polled  timestamptz,
  updated_at   timestamptz not null default now(),
  primary key (user_id, aircraft_id)
);

alter table public.monitored_aircraft enable row level security;

drop policy if exists "own monitored rw"     on public.monitored_aircraft;
drop policy if exists "own monitored update" on public.monitored_aircraft;
drop policy if exists "own monitored read"   on public.monitored_aircraft;
drop policy if exists "own monitored delete" on public.monitored_aircraft;

create policy "own monitored read"
  on public.monitored_aircraft for select using (auth.uid() = user_id);
create policy "own monitored rw"
  on public.monitored_aircraft for insert with check (auth.uid() = user_id);
create policy "own monitored update"
  on public.monitored_aircraft for update using (auth.uid() = user_id);
create policy "own monitored delete"
  on public.monitored_aircraft for delete using (auth.uid() = user_id);

-- ── Cron trigger ────────────────────────────────────────────────────────────
-- Fires the Edge Function every 5 minutes. Replace <PROJECT_REF> and
-- <MONITOR_SECRET> before running. The secret must match the MONITOR_SECRET
-- env var set on the Edge Function.
--
--   select cron.unschedule('flight-monitor');  -- to remove
--
-- select cron.schedule(
--   'flight-monitor',
--   '*/5 * * * *',
--   $$
--   select net.http_post(
--     url     := 'https://<PROJECT_REF>.functions.supabase.co/flight-monitor',
--     headers := jsonb_build_object(
--       'Content-Type', 'application/json',
--       'Authorization', 'Bearer <MONITOR_SECRET>'
--     ),
--     body    := '{}'::jsonb
--   );
--   $$
-- );
--
-- Verify:  select jobid, schedule, jobname from cron.job;
