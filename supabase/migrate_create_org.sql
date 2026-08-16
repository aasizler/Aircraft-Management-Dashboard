-- ============================================================================
-- AeroTrack — let a new account create its own hangar
-- ----------------------------------------------------------------------------
-- A fresh account belongs to no org, and the Add Aircraft button only renders
-- for someone who does — so a new user could sign up and had no way to add an
-- aircraft at all. The only route in was for an existing org to grant them
-- access to something.
--
-- It cannot be done from the client, and not for want of a button: the two
-- policies deadlock.
--
--   org insert    → with check (auth.uid() = created_by)     -- you may create
--   members write → with check (is_org_admin(org_id))        -- admins only
--
-- You are not a member of the org you just created, so you are not its admin,
-- so you cannot add yourself. The org would exist with nobody in it and the
-- creator locked out.
--
-- SECURITY DEFINER performs both writes as one act. It is deliberately narrow:
-- it inserts an org owned by the caller and exactly one membership, the
-- caller's, as admin — it takes no user id, so it cannot be used to add anyone
-- to anything.
--
-- Idempotent. Safe to re-run.
-- ============================================================================

create or replace function public.create_org(p_name text)
returns uuid language plpgsql security definer set search_path = public as $$
declare
  v_uid  uuid := auth.uid();
  v_name text := nullif(trim(p_name), '');
  v_slug text;
  v_org  uuid;
begin
  if v_uid is null then
    raise exception 'not signed in';
  end if;
  if v_name is null then
    raise exception 'name is required';
  end if;

  -- One org per account here. A management company running several is a real
  -- case, but it needs an invite flow rather than a button on an empty hangar,
  -- and silently accumulating orgs from repeated clicks is the worse failure.
  if exists (select 1 from public.org_members m where m.user_id = v_uid) then
    raise exception 'you already belong to an organisation';
  end if;

  -- Slug from the name, with a short suffix so two "Hired Wings" can coexist.
  v_slug := left(regexp_replace(lower(v_name), '[^a-z0-9]+', '-', 'g'), 40);
  v_slug := trim(both '-' from v_slug);
  if v_slug = '' then v_slug := 'org'; end if;
  v_slug := v_slug || '-' || substr(md5(random()::text || v_uid::text), 1, 6);

  insert into public.orgs (name, slug, created_by)
    values (v_name, v_slug, v_uid)
    returning id into v_org;

  insert into public.org_members (org_id, user_id, role)
    values (v_org, v_uid, 'admin');

  return v_org;
end $$;

revoke all on function public.create_org(text) from public, anon;
grant execute on function public.create_org(text) to authenticated;
