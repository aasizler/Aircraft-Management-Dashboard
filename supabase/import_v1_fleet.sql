-- ============================================================================
-- AeroTrack — v1 → v2 fleet import
-- ----------------------------------------------------------------------------
-- Reads the legacy `fleet` blob (one jsonb array per user) and expands it into
-- first-class `aircraft` rows + seeded `aircraft_meters`. Run AFTER
-- schema_v2_tenancy.sql and the org bootstrap.
--
-- Idempotent: matches on legacy_id, so re-running updates instead of duplicating.
--
-- What it does NOT do: flights / oil / inspections stay inside aircraft.data for
-- now (the detail UI reads them there); they get normalized later. Meter basis
-- defaults to 'hobbs' for every aircraft — set per-aircraft afterward (e.g. the
-- Cirrus → maint_basis='flight', cost_basis='total').
-- ============================================================================
do $$
declare
  v_org   uuid;
  v_user  uuid;
  v_fleet jsonb;
  v_ac    jsonb;
  v_craft uuid;
  v_hobbs numeric;
  v_tt    numeric;
  v_idx   int := 0;
begin
  select id into v_org from public.orgs where slug = 'hired-wings';
  if v_org is null then
    raise exception 'org "hired-wings" not found — run the bootstrap insert first';
  end if;

  select id into v_user from auth.users where email = 'aasizler@gmail.com';
  if v_user is null then
    raise exception 'auth user aasizler@gmail.com not found';
  end if;

  select data::jsonb into v_fleet from public.fleet where user_id = v_user;
  if v_fleet is null then
    raise notice 'no fleet blob for this user — nothing to import';
    return;
  end if;

  for v_ac in select value from jsonb_array_elements(v_fleet) loop
    v_idx := v_idx + 1;
    v_hobbs := nullif(v_ac->>'hobbs','')::numeric;
    v_tt    := nullif(v_ac->>'tt','')::numeric;

    -- Match on legacy_id (the v1 aircraft id) so re-runs update in place.
    select id into v_craft
      from public.aircraft
     where org_id = v_org and legacy_id = (v_ac->>'id');

    if v_craft is null then
      insert into public.aircraft
        (org_id, reg, serial, type, airport, maint_basis, cost_basis,
         data, sort_order, legacy_id)
      values
        (v_org,
         coalesce(v_ac->>'reg', '(unknown)'),
         v_ac->>'serial',
         v_ac->>'type',
         v_ac->>'airport',
         'hobbs', 'hobbs',
         v_ac, v_idx, v_ac->>'id')
      returning id into v_craft;
    else
      update public.aircraft
         set reg     = coalesce(v_ac->>'reg', reg),
             serial  = v_ac->>'serial',
             type    = v_ac->>'type',
             airport = v_ac->>'airport',
             data    = v_ac
       where id = v_craft;
    end if;

    -- Seed meters from the v1 hobbs / tt fields.
    if v_hobbs is not null then
      insert into public.aircraft_meters (aircraft_id, kind, current)
      values (v_craft, 'hobbs', v_hobbs)
      on conflict (aircraft_id, kind) do update set current = excluded.current;
    end if;
    if v_tt is not null then
      insert into public.aircraft_meters (aircraft_id, kind, current)
      values (v_craft, 'total', v_tt)
      on conflict (aircraft_id, kind) do update set current = excluded.current;
    end if;
  end loop;

  raise notice 'imported/updated % aircraft', v_idx;
end $$;
