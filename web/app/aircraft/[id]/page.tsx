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

  const { data: { user } } = await supabase.auth.getUser();

  const [{ data: meters }, { data: membership }, { data: grants }] = await Promise.all([
    supabase.from("aircraft_meters").select("kind, current, label").eq("aircraft_id", id),
    supabase.from("org_members").select("role").eq("org_id", a.org_id).maybeSingle(),
    // NOT maybeSingle: the access read policy also returns other people's
    // grants on aircraft you administer. With one other grant present this
    // resolved the viewer's role from SOMEONE ELSE's row, and with two it
    // errored and silently fell back to null.
    supabase
      .from("aircraft_access")
      .select("role, user_id, invited_email, granted_by_name, granted_by_email")
      .eq("aircraft_id", id)
      .eq("accepted", true),
  ]);

  const mine = (grants ?? []).find(
    (g) =>
      (user?.id && g.user_id === user.id) ||
      (user?.email && g.invited_email?.toLowerCase() === user.email.toLowerCase()),
  );

  // v1 gated the UI with can(); RLS is still the real boundary.
  const role = resolveRole(membership?.role, mine?.role);

  // Not a member of this aircraft's org, so it's someone else's record shared
  // with you. v1 badged the hero SHARED vs LOCAL; registrations are unique only
  // within an org, so two aircraft can legitimately read the same tail number.
  const shared = !membership;

  return (
    <>
      <PageHeader title="Aircraft Details" />
      <AircraftDetailClient
        aircraft={a as AircraftRow}
        meters={(meters ?? []) as Meter[]}
        role={role}
        shared={shared}
        sharedBy={mine?.granted_by_name?.trim() || mine?.granted_by_email || null}
      />
    </>
  );
}
