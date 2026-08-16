-- ============================================================================
-- AeroTrack — confirm an invitee has an account before granting
-- ----------------------------------------------------------------------------
-- Access could be granted to any string that looked like an email. A typo
-- produced a grant that silently matched nobody, sat in the list as "Pending
-- acceptance" forever, and gave no clue it was addressed to an account that
-- does not exist.
--
-- v1 checked first, through a check_user_exists() RPC. That function was
-- dropped during the cleanup as dead code — correctly, since nothing in the
-- port called it — so this brings it back, returning the display name too so
-- the UI can confirm WHO was found rather than just that someone was.
--
-- Enumeration: this does let a signed-in user test whether an address has an
-- account. That is inherent to confirming an invitee, and v1 accepted the same
-- trade. Execute is granted to `authenticated` only — anon cannot call it — so
-- it is not an open oracle.
--
-- Idempotent. Safe to re-run.
-- ============================================================================

-- v1's version still exists and returned boolean; CREATE OR REPLACE cannot
-- change a return type. Drop whatever signatures are present rather than
-- guessing at one — v1's took (lookup_email text), and a stale overload would
-- make the call ambiguous even if the create succeeded.
do $$
declare r record;
begin
  for r in
    select p.oid::regprocedure as sig
      from pg_proc p
      join pg_namespace n on n.oid = p.pronamespace
     where n.nspname = 'public' and p.proname = 'check_user_exists'
  loop
    execute format('drop function %s', r.sig);
  end loop;
end $$;

create or replace function public.check_user_exists(p_email text)
returns jsonb language sql stable security definer set search_path = public as $$
  select coalesce(
    (select jsonb_build_object(
              'found', true,
              'name',  nullif(trim(u.raw_user_meta_data ->> 'full_name'), '')
            )
       from auth.users u
      where lower(u.email) = lower(trim(p_email))
      limit 1),
    jsonb_build_object('found', false)
  );
$$;

revoke all on function public.check_user_exists(text) from public, anon;
grant execute on function public.check_user_exists(text) to authenticated;
