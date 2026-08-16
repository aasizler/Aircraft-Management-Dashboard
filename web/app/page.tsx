import { createClient } from "@/lib/supabase/server";
import { AddAircraftButton } from "@/components/hangar/add-aircraft";
import { HangarGrid, type Tile } from "@/components/hangar/hangar-grid";
import { PageHeader } from "@/components/ui/page-header";
import { PendingInvites } from "@/components/pending-invites";
import type { Meter } from "@/lib/aircraft";

// Hangar view. Middleware guarantees a session. Reads the fleet through RLS.
export default async function Home() {
  const supabase = await createClient();

  // `data` and the meters come along so each tile can compute its own
  // airworthiness dot, exactly as v1's renderHangar did.
  const { data: { user } } = await supabase.auth.getUser();

  const [{ data: aircraft, error }, { data: membership }, { data: meters }] =
    await Promise.all([
      supabase
        .from("aircraft")
        .select("id, reg, type, serial, airport, maint_basis, data")
        // Nothing in the app sets `archived` any more — kept only so a row
        // archived by an earlier build stays hidden.
        .eq("archived", false)
        .order("sort_order"),
      supabase.from("org_members").select("org_id, role").limit(1).maybeSingle(),
      supabase.from("aircraft_meters").select("aircraft_id, kind, current, label"),
    ]);

  const metersFor = (id: string): Meter[] =>
    ((meters ?? []) as (Meter & { aircraft_id: string })[])
      .filter((m) => m.aircraft_id === id)
      .map(({ kind, current, label }) => ({ kind, current, label }));

  const tiles: Tile[] = ((aircraft ?? []) as Omit<Tile, "meters" | "role">[]).map((a) => ({
    ...a,
    meters: metersFor(a.id),
    role: membership?.role === "admin" || membership?.role === "manager" ? "Owner" : "Shared",
  }));

  return (
    <>
      {user?.email && <PendingInvites email={user.email} />}

      <PageHeader
        title="My Hangar"
        right={membership?.org_id ? <AddAircraftButton orgId={membership.org_id} /> : undefined}
      />

      <div className="hangar-wrap">
        <div className="section-lbl">Active Aircraft</div>
        <div className="section-sub">All aircraft you currently own or are managing.</div>

        {error ? (
          <div className="how-box" style={{ color: "var(--warn)" }}>
            Could not load aircraft: {error.message}
          </div>
        ) : tiles.length > 0 ? (
          <HangarGrid aircraft={tiles} />
        ) : (
          <div className="how-box">
            No aircraft yet. Use <b>+ Add Aircraft</b> to get started.
          </div>
        )}
      </div>
    </>
  );
}
