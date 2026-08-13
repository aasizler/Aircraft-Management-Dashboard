import { createClient } from "@/lib/supabase/server";
import { AddAircraftButton } from "@/components/hangar/add-aircraft";
import { HangarGrid } from "@/components/hangar/hangar-grid";

// Hangar view. Middleware guarantees a session. Reads the fleet through RLS.
export default async function Home() {
  const supabase = await createClient();

  const [{ data: aircraft, error }, { data: membership }] = await Promise.all([
    supabase
      .from("aircraft")
      .select("id, reg, type, serial, airport")
      .eq("archived", false)
      .order("sort_order"),
    supabase.from("org_members").select("org_id").limit(1).maybeSingle(),
  ]);

  return (
    <>
      <div
        className="page-hd"
        style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between" }}
      >
        <div>
          <div className="page-title">Hangar</div>
          <div className="page-sub">
            {aircraft?.length ?? 0} aircraft under management
          </div>
        </div>
        {membership?.org_id && <AddAircraftButton orgId={membership.org_id} />}
      </div>

      <div className="hangar-wrap">
        {error ? (
          <div className="how-box" style={{ color: "var(--warn)" }}>
            Could not load aircraft: {error.message}
          </div>
        ) : aircraft && aircraft.length > 0 ? (
          <HangarGrid aircraft={aircraft} />
        ) : (
          <div className="how-box">
            No aircraft yet. Run the import script to bring the fleet over.
          </div>
        )}
      </div>
    </>
  );
}
