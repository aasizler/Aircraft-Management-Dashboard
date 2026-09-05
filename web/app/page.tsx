import { createClient } from "@/lib/supabase/server";
import { AddAircraftButton } from "@/components/hangar/add-aircraft";
import { NewFleetButton } from "@/components/hangar/new-fleet";
import { HangarGrid, type Fleet, type Tile } from "@/components/hangar/hangar-grid";
import { AdRibbon, type FleetSummary } from "@/components/hangar/ad-ribbon";
import { readMonthly, type SchedEvent } from "@/lib/aircraft";
import { PageHeader } from "@/components/ui/page-header";
import type { Meter } from "@/lib/aircraft";
import { resolveRole } from "@/lib/permissions";
import type { CraftRole } from "@/lib/types";

// Hangar view. Middleware guarantees a session. Reads the fleet through RLS.
export default async function Home() {
  const supabase = await createClient();

  // `data` and the meters come along so each tile can compute its own
  // airworthiness dot, exactly as v1's renderHangar did.
  const { data: { user } } = await supabase.auth.getUser();

  const [
    { data: aircraft, error },
    { data: membership },
    { data: meters },
    { data: grants },
    { data: fleets },
    { data: financials },
  ] =
    await Promise.all([
      supabase
        .from("aircraft")
        .select("id, org_id, fleet_id, reg, type, serial, airport, maint_basis, cost_basis, data")
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
        .select("id, aircraft_id, fleet_id, role, user_id, invited_email, granted_by_name, granted_by_email")
        .eq("accepted", true),
      // Fleets are sections in the hangar, so they're needed to render it —
      // not just to edit one.
      supabase.from("fleets").select("id, name, org_id").order("name"),
      // Insurance expiry for the rail. RLS gates this to viewers with financial
      // access, so a pilot simply gets no rows and no expiry line.
      supabase.from("aircraft_financials").select("aircraft_id, insurance"),
    ]);

  type FinRow = { aircraft_id: string; insurance: { expiration?: string } | null };

  type GrantRow = {
    id: string;
    aircraft_id: string;
    fleet_id: string | null;
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

  // Which fleets this viewer may pass on. Org staff administer every fleet in
  // their own hangar; anyone else may share only a fleet they hold a `manager`
  // grant on. This mirrors can_share_fleet() in the database exactly — the UI
  // must not offer an action RLS is going to refuse.
  const isStaff = membership?.role === "admin" || membership?.role === "manager";
  const shareableFleetIds = isStaff
    ? ((fleets ?? []) as { id: string }[]).map((f) => f.id)
    : mine
        .filter((g) => g.fleet_id && g.role === "manager")
        .map((g) => g.fleet_id as string);

  const metersFor = (id: string): Meter[] =>
    ((meters ?? []) as (Meter & { aircraft_id: string })[])
      .filter((m) => m.aircraft_id === id)
      .map(({ kind, current, label }) => ({ kind, current, label }));

  const tiles: Tile[] = (
    (aircraft ?? []) as (Omit<
      Tile,
      "meters" | "appRole" | "shared" | "sharedBy" | "fleetId"
    > & { org_id: string; fleet_id: string | null })[]
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
    fleetId: a.fleet_id ?? null,
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
        // Always offered. An account with no hangar gets one made on first use
        // rather than being sent through a separate "create an organisation"
        // step — the org is plumbing, not a concept the owner of one aeroplane
        // should have to meet.
        right={
          <span className="hangar-actions">
            {/* Staff only — fleets write is is_org_staff(). Someone with one
                aeroplane never needs a fleet, so this sits beside Add Aircraft
                rather than competing with it. */}
            {(membership?.role === "admin" || membership?.role === "manager") &&
              membership?.org_id && <NewFleetButton orgId={membership.org_id} />}
          <AddAircraftButton
            orgId={membership?.org_id}
            fleets={(fleets ?? []) as { id: string; name: string }[]}
            hangarName={
              (() => {
                const m = user?.user_metadata as
                  | { first_name?: string; full_name?: string }
                  | undefined;
                // Accounts predating the first/last split carry only full_name.
                return m?.first_name || m?.full_name?.split(/\s+/)[0] || null;
              })()
            }
          />
          </span>
        }
      />

      <div className="hangar-wrap">
        {error ? (
          <div className="how-box" style={{ color: "var(--warn)" }}>
            Could not load aircraft: {error.message}
          </div>
        ) : tiles.length > 0 ? (
          // The rail takes the width the grid was leaving empty at three
          // aircraft, and pays for it with something the hangar could not say
          // before. It drops below the grid under 1100px rather than squeezing
          // the tiles.
          <div className="hangar-cols">
            <div>
              <HangarGrid
                aircraft={tiles}
                fleets={(fleets ?? []) as Fleet[]}
                canManageFleets={isStaff}
                shareableFleetIds={shareableFleetIds}
              />
            </div>
            <AdRibbon
              summary={(() => {
                // Computed on the server, which already holds every aircraft's
                // data blob and financial row.
                const now = new Date();


                // monthlyHours is a plain array indexed by month, newest last —
                // readMonthly() is the shape-tolerant reader for it.
                const hours = tiles.reduce((sum, t) => {
                  const m = readMonthly(t.data?.monthlyHours, 6);
                  return sum + (m.length ? m[m.length - 1].hours : 0);
                }, 0);

                // Nearest future booking or maintenance slot across the hangar.
                const upcoming = tiles
                  .flatMap((t) =>
                    ((t.data?.schedule ?? []) as SchedEvent[])
                      .filter((e) => e.start && new Date(e.start) >= now)
                      .map((e) => ({ reg: t.reg, e })),
                  )
                  .sort((a, b) => (a.e.start ?? "").localeCompare(b.e.start ?? ""));
                const soonest = upcoming[0];
                const days = (iso: string) =>
                  Math.round((new Date(iso).getTime() - now.getTime()) / 86_400_000);

                // Insurance lives in aircraft_financials, not the data blob;
                // a viewer without financial access simply gets no rows.
                const expiring = ((financials ?? []) as FinRow[])
                  .map((f) => {
                    const exp = f.insurance?.expiration;
                    const reg = tiles.find((t) => t.id === f.aircraft_id)?.reg;
                    if (!exp || !reg) return null;
                    const d = days(exp);
                    return d >= 0 && d <= 60 ? { reg, date: exp, days: d } : null;
                  })
                  .filter((x): x is { reg: string; date: string; days: number } => x != null)
                  .sort((a, b) => a.days - b.days);

                const out: FleetSummary = {
                  hours: Math.round(hours * 10) / 10,
                  next: soonest
                    ? {
                        reg: soonest.reg,
                        text: soonest.e.title || soonest.e.type || "scheduled",
                        when: `${days(soonest.e.start!)}d`,
                      }
                    : null,
                  expiring,
                };

                return out;
              })()
              }
              fleet={tiles.map((t) => ({
                id: t.id,
                reg: t.reg,
                type: t.type,
                engineType: (t.data?.engineType as string | null) ?? null,
              }))}
            />
          </div>
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
                <div style={{ marginBottom: 8 }}>
                  No aircraft yet. Use <b>+ Add Aircraft</b> to get started.
                </div>
                <div style={{ fontSize: 12, color: "var(--muted2)" }}>
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
