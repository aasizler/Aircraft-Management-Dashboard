-- ============================================================================
-- AeroTrack — carry display names on the grant
-- ----------------------------------------------------------------------------
-- Notifications named people by email address. With several people on one
-- aircraft that reads as noise: "aasizler@yahoo.com accepted your invitation"
-- tells you less at a glance than "Elizabeth Berry".
--
-- Signup already captures the name — full_name in the user's metadata — but one
-- user cannot read another's row in auth.users, and v1's get_user_display_name()
-- RPC was dropped during the cleanup. So the name rides on the grant, the same
-- way aircraft_reg already does.
--
-- These are snapshots. Someone who renames themselves later keeps the old name
-- on existing grants until they are re-issued. That is the trade for not
-- running a lookup on every render, and it is fine for a toast.
--
-- Idempotent. Safe to re-run.
-- ============================================================================

alter table public.aircraft_access add column if not exists granted_by_name text;
alter table public.aircraft_access add column if not exists user_name       text;

-- ── Stamp on insert ─────────────────────────────────────────────────────────
-- Extends the existing trigger rather than adding a second one.
create or replace function public.stamp_access_details()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  select a.reg, a.type into new.aircraft_reg, new.aircraft_type
    from public.aircraft a where a.id = new.aircraft_id;

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
  before insert or update of aircraft_id on public.aircraft_access
  for each row execute function public.stamp_access_details();


-- ── Stamp on accept ─────────────────────────────────────────────────────────
-- The invitee's own name isn't knowable until they exist and accept.
create or replace function public.claim_aircraft_access(p_access uuid)
returns boolean language plpgsql security definer set search_path = public as $$
declare
  v_email text := lower(auth.jwt() ->> 'email');
  v_name  text;
begin
  if auth.uid() is null then return false; end if;

  select nullif(trim(u.raw_user_meta_data ->> 'full_name'), '')
    into v_name
    from auth.users u where u.id = auth.uid();

  update public.aircraft_access
     set accepted  = true,
         user_id   = coalesce(user_id, auth.uid()),
         user_name = coalesce(v_name, user_name)
   where id = p_access
     and not accepted
     and (user_id = auth.uid()
          or (v_email is not null and lower(invited_email) = v_email));
  return found;
end $$;


-- ── Backfill ────────────────────────────────────────────────────────────────
-- Existing grants predate the columns; fill what can be resolved now.
update public.aircraft_access ac
   set user_name = nullif(trim(u.raw_user_meta_data ->> 'full_name'), '')
  from auth.users u
 where ac.user_name is null
   and ac.user_id = u.id;

update public.aircraft_access ac
   set granted_by_name = nullif(trim(u.raw_user_meta_data ->> 'full_name'), '')
  from auth.users u
 where ac.granted_by_name is null
   and lower(ac.granted_by_email) = lower(u.email);
