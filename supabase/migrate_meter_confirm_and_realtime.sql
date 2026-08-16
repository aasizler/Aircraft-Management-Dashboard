-- ============================================================================
-- AeroTrack — meter confirmation thresholds + realtime publication
-- ----------------------------------------------------------------------------
-- Run this whole file once in the Supabase dashboard SQL editor. It is
-- idempotent: re-running it is safe.
--
-- 1. apply_meter_reading() no longer refuses a large jump.
--    * FIRST reading for a meter (nothing recorded yet) is accepted outright —
--      there is no prior value to be implausible against, and the old >50hr
--      guard made it impossible to ever enter a starting number. This is what
--      blocked N137BF (current = 0, meter reads 4349.4).
--    * AFTER that, a jump over 10 hours does not reject. It returns
--      needs_confirmation with the numbers, the client shows a specific "does
--      this look right?" prompt, and re-calls with p_confirm => true.
--    * A reading BELOW the current value is still refused: that is a misread or
--      a swapped meter, and silently walking hours backwards would corrupt
--      every interval that counts up from them.
--
-- 2. Adds `aircraft` and `aircraft_access` to the supabase_realtime
--    publication. lib/realtime.ts already subscribes to both; without this the
--    database never emits the events, so live sync silently does nothing.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. Meter application
-- ----------------------------------------------------------------------------

-- Hours a meter may advance in one capture before a human is asked to confirm.
-- Not a rejection threshold — just the point where we stop assuming.
create or replace function public.meter_confirm_threshold()
returns numeric language sql immutable as $$ select 10::numeric $$;

-- No DEFAULT on p_confirm: with the 1-arg wrapper below also present, a default
-- would make apply_meter_reading(uuid) ambiguous and Postgres would refuse the
-- call with "function is not unique".
create or replace function public.apply_meter_reading(
  p_reading uuid,
  p_confirm boolean
)
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

  -- Validate EVERY meter before writing ANY of them: a capture is applied whole
  -- or not at all, so a bad tach read can't leave flight time half-committed.
  for k, v in select key, value::text::numeric from jsonb_each(r.values_final) loop
    cur := public.meter_value(r.aircraft_id, k::meter_kind);

    -- First reading for this meter: it IS the baseline, so nothing to check.
    -- A meter genuinely sitting at 0 is indistinguishable from an unset one,
    -- and in both cases the first number entered is the truth.
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

  -- Something jumped further than expected and nobody has vouched for it yet.
  -- Hand the numbers back so the UI can ask about the specific meter.
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

  -- Record that a human accepted an unusual jump, so the audit trail shows the
  -- guard fired and was answered rather than never having run.
  update public.meter_readings
     set status = 'confirmed',
         confirmed_by = auth.uid(),
         confirmed_at = now(),
         flagged = flagged or p_confirm,
         flag_reason = case when p_confirm then coalesce(flag_reason, 'large_delta_confirmed')
                            else flag_reason end
   where id = p_reading;

  return jsonb_build_object('ok', true, 'applied', applied);
end $$;

-- The 1-arg signature is what older clients call; keep it working.
create or replace function public.apply_meter_reading(p_reading uuid)
returns jsonb language sql security definer set search_path = public as $$
  select public.apply_meter_reading(p_reading, false)
$$;

grant execute on function public.apply_meter_reading(uuid) to authenticated;
grant execute on function public.apply_meter_reading(uuid, boolean) to authenticated;

-- ----------------------------------------------------------------------------
-- 2. Realtime publication
-- ----------------------------------------------------------------------------
-- `aircraft_access` gets REPLICA IDENTITY FULL because the client listens for
-- DELETE (a revoked grant) and Postgres otherwise ships only the primary key,
-- which is not enough for RLS to decide whether the subscriber may see it.
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
     where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'aircraft'
  ) then
    alter publication supabase_realtime add table public.aircraft;
  end if;

  if not exists (
    select 1 from pg_publication_tables
     where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'aircraft_access'
  ) then
    alter publication supabase_realtime add table public.aircraft_access;
  end if;
end $$;

alter table public.aircraft_access replica identity full;

-- ----------------------------------------------------------------------------
-- Verify
-- ----------------------------------------------------------------------------
select tablename as published_for_realtime
  from pg_publication_tables
 where pubname = 'supabase_realtime' and schemaname = 'public'
 order by tablename;
