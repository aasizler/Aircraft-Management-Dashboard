import { createClient } from "@/lib/supabase/server";
import { AddAircraftButton } from "@/components/hangar/add-aircraft";
import { HangarGrid, type Tile } from "@/components/hangar/hangar-grid";
import { PageHeader } from "@/components/ui/page-header";
import { CreateOrg } from "@/components/hangar/create-org";
import type { Meter } from "@/lib/aircraft";
import { resolveRole } from "@/lib/permissions";
import type { CraftRole } from "@/lib/types";

// Hangar view. Middleware guarantees a session. Reads the fleet through RLS.
export default async function Home() {
  const supabase = await createClient();

  // `data` and the meters come along so each tile can compute its own
  // airworthiness dot, exactly as v1's renderHangar did.
  const { data: { user } } = await supabase.auth.getUser();

  const [{ data: aircraft, error }, { data: membership }, { data: meters }, { data: grants }] =
    await Promise.all([
      supabase
        .from("aircraft")
        .select("id, org_id, reg, type, serial, airport, maint_basis, data")
        // Nothing in the app sets `archived` any more — kept only so a row
        // archived by an earlier build stays hidden.
        .eq("archived", false)
        .order("sort_order"),
      supabase.from("org_members").select("org_id, role").limit(1).maybeSingle(),
      supabase.from("aircraft_meters").select("aircraft_id, kind, current, label"),
      // Per-aircraft grant, so each tile can resolve its own role. Org
      // membership alone can't: a shared aircraft carries a craft role that
      // decides whether this user may delete it, exactly as v1's getRole(id)
      // returned the share's role rather than a single global one.
      supabase
        .from("aircraft_access")
        .select("id, aircraft_id, role, user_id, invited_email, granted_by_name, granted_by_email")
        .eq("accepted", true),
    ]);

  type GrantRow = {
    id: string;
    aircraft_id: string;
    role: CraftRole;
    user_id: string | null;
    invited_email: string | null;
    granted_by_name: string | null;
    granted_by_email: string | null;
  };

  // The `access read` policy also returns OTHER people's grants on aircraft
  // this user administers, so narrow to their own before resolving a role or
  // offering to surrender one — otherwise a manager's tile could pick up a
  // co-owner's row.
  const mine = ((grants ?? []) as GrantRow[]).filter(
    (g) =>
      (user?.id && g.user_id === user.id) ||
      (user?.email &&
        g.invited_email?.toLowerCase() === user.email.toLowerCase()),
  );
  const grantFor = (id: string): GrantRow | undefined =>
    mine.find((g) => g.aircraft_id === id);

  const metersFor = (id: string): Meter[] =>
    ((meters ?? []) as (Meter & { aircraft_id: string })[])
      .filter((m) => m.aircraft_id === id)
      .map(({ kind, current, label }) => ({ kind, current, label }));

  const tiles: Tile[] = (
    (aircraft ?? []) as (Omit<Tile, "meters" | "appRole" | "shared" | "sharedBy"> & {
      org_id: string;
    })[]
  ).map((a) => ({
    ...a,
    meters: metersFor(a.id),
    // The effective role for THIS aircraft. The tile badge and the delete gate
    // both read it; previously the badge was a flat Owner/Shared guess and
    // nothing gated delete at all.
    appRole: resolveRole(membership?.role, grantFor(a.id)?.role),
    // The grant's own role, for the badge. appRole names a permission set, so
    // a Pilot grant renders as "Mechanic" through it — the wrong word to show
    // someone whose granter picked "Pilot".
    craftRole: grantFor(a.id)?.role ?? null,
    // Present only when this user reaches the aircraft through a grant of
    // their own — which is the only thing they can hand back.
    grantId: grantFor(a.id)?.id ?? null,
    // Nothing stops two orgs holding a record for the same airframe, and a
    // registration is only unique WITHIN an org — so two tiles can legitimately
    // read N137BF. Mark the ones that aren't yours, as v1's hero did with its
    // SHARED / LOCAL badge, or they're indistinguishable.
    shared: !membership?.org_id || a.org_id !== membership.org_id,
    sharedBy:
      grantFor(a.id)?.granted_by_name?.trim() ||
      grantFor(a.id)?.granted_by_email ||
      null,
  }));

  return (
    <>
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
            {membership?.org_id ? (
              <>No aircraft yet. Use <b>+ Add Aircraft</b> to get started.</>
            ) : (
              // A brand-new account belongs to no org, so AddAircraftButton is
              // not rendered — telling them to press it was a dead end. Show
              // the address a grant has to match instead: invites are keyed on
              // email, and signing up under a different one is the failure
              // people actually hit.
              <>
                <div style={{ marginBottom: 12 }}>
                  You don&apos;t have a hangar yet. Create one to start adding
                  your own aircraft.
                </div>
                <CreateOrg
                  suggested={
                    (user?.user_metadata as { first_name?: string } | undefined)
                      ?.first_name
                  }
                />
                <div style={{ marginTop: 14, fontSize: 12, color: "var(--muted2)" }}>
                  Aircraft shared with you appear here too — ask whoever manages
                  one to grant <b>{user?.email}</b> under Manage Access.
                </div>
              </>
            )}
          </div>
        )}
      </div>
    </>
  );
}
