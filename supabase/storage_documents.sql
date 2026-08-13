-- ============================================================================
-- AeroTrack — Storage policies for the `documents` bucket
-- ----------------------------------------------------------------------------
-- Run after schema_v2_tenancy.sql. Files are stored under a path whose FIRST
-- folder segment is the aircraft id: `{aircraft_id}/{timestamp}_{filename}`.
-- Access mirrors the aircraft's RLS: anyone who can read the aircraft can read
-- its documents; managers (org staff) upload and delete.
-- ============================================================================

-- Private bucket (id must equal name for the storage API path used by the app).
insert into storage.buckets (id, name, public)
values ('documents', 'documents', false)
on conflict (id) do nothing;

-- Note: RLS is already enabled on storage.objects by Supabase — do NOT try to
-- `alter table storage.objects ...` (you're not its owner; it errors 42501).
-- Creating policies on it, below, is permitted.

drop policy if exists "docs read"   on storage.objects;
drop policy if exists "docs insert" on storage.objects;
drop policy if exists "docs delete" on storage.objects;

-- Read: any current relationship to the aircraft in the first path segment.
create policy "docs read" on storage.objects for select
  using (
    bucket_id = 'documents'
    and public.can_read_aircraft(((storage.foldername(name))[1])::uuid)
  );

-- Upload: managers/org staff only.
create policy "docs insert" on storage.objects for insert
  with check (
    bucket_id = 'documents'
    and public.can_manage_aircraft(((storage.foldername(name))[1])::uuid)
  );

-- Delete: managers/org staff only.
create policy "docs delete" on storage.objects for delete
  using (
    bucket_id = 'documents'
    and public.can_manage_aircraft(((storage.foldername(name))[1])::uuid)
  );
