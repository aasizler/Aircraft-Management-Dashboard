-- ============================================================================
-- AeroTrack — database audit and cleanup
-- ----------------------------------------------------------------------------
-- Part 1 reports. Part 2 drops only what Part 1 and the repo agree is dead.
-- Run Part 1 first and read it; nothing in Part 1 changes anything.
-- ============================================================================

-- ── PART 1: what's actually in there ────────────────────────────────────────
-- Run this whole block and send me the output.

with tbls as (
  select c.relname as name,
         (xpath('/row/c/text()',
           query_to_xml(format('select count(*) as c from public.%I', c.relname),
                        false, true, '')))[1]::text::bigint as n
  from pg_class c
  join pg_namespace ns on ns.oid = c.relnamespace
  where ns.nspname = 'public' and c.relkind = 'r'
)
select 'table' as kind, name, n::text as detail from tbls
union all
select 'function', p.proname,
       coalesce(nullif(pg_get_function_identity_arguments(p.oid), ''), '(no args)')
  from pg_proc p join pg_namespace ns on ns.oid = p.pronamespace
 where ns.nspname = 'public'
union all
select 'policy', pol.polname, cls.relname
  from pg_policy pol join pg_class cls on cls.oid = pol.polrelid
union all
select 'trigger', t.tgname, c.relname
  from pg_trigger t join pg_class c on c.oid = t.tgrelid
  join pg_namespace ns on ns.oid = c.relnamespace
 where ns.nspname = 'public' and not t.tgisinternal
union all
select 'extension', extname, extversion from pg_extension where extname <> 'plpgsql'
union all
select 'realtime', tablename, schemaname
  from pg_publication_tables where pubname = 'supabase_realtime'
union all
select 'bucket', id, case when public then 'PUBLIC' else 'private' end
  from storage.buckets
order by 1, 2;

-- Cron jobs live in their own schema and error if pg_cron was never installed:
--   select jobid, jobname, schedule, active from cron.job;


-- ============================================================================
-- ── PART 2: the drops ───────────────────────────────────────────────────────
-- Every one of these was checked against the repo: nothing in web/ calls them
-- and nothing in supabase/*.sql references them.
-- ============================================================================

-- v1's display-name lookup. Replaced by granted_by_name / user_name stamped
-- onto the grant; the cleanup earlier generated a DROP for it that never ran.
drop function if exists public.get_user_display_name(uuid);

-- Defined in schema_v2_tenancy.sql and never called by anything — not by a
-- policy, not by another function, not by the app, which computes both
-- client-side in lib/aircraft.ts (meterValue). meter_value() itself STAYS:
-- apply_meter_reading() calls it.
drop function if exists public.maint_hours(uuid);
drop function if exists public.cost_hours(uuid);
