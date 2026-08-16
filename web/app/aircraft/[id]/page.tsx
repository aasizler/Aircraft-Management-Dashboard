import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { AircraftDetailClient } from "@/components/aircraft/detail-client";
import { PageHeader } from "@/components/ui/page-header";
import { resolveRole } from "@/lib/permissions";
import type { AircraftRow, Meter } from "@/lib/aircraft";

export default async function AircraftDetail({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();

  const { data: a } = await supabase
    .from("aircraft")
    .select("id, org_id, reg, type, airport, serial, maint_basis, cost_basis, data")
    .eq("id", id)
    .single();

  if (!a) notFound();

  const [{ data: meters }, { data: membership }, { data: grant }] = await Promise.all([
    supabase.from("aircraft_meters").select("kind, current, label").eq("aircraft_id", id),
    supabase.from("org_members").select("role").eq("org_id", a.org_id).maybeSingle(),
    supabase.from("aircraft_access").select("role").eq("aircraft_id", id).maybeSingle(),
  ]);

  // v1 gated the UI with can(); RLS is still the real boundary.
  const role = resolveRole(membership?.role, grant?.role);

  return (
    <>
      <PageHeader title="Aircraft Details" />
      <AircraftDetailClient
        aircraft={a as AircraftRow}
        meters={(meters ?? []) as Meter[]}
        role={role}
      />
    </>
  );
}
