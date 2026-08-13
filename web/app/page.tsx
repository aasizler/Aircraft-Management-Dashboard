import Link from "next/link";
import { createClient } from "@/lib/supabase/server";

// Hangar view. Middleware guarantees a session. Reads the fleet through RLS.
export default async function Home() {
  const supabase = await createClient();

  const { data: aircraft, error } = await supabase
    .from("aircraft")
    .select("id, reg, type, serial, airport")
    .eq("archived", false)
    .order("sort_order");

  return (
    <>
      <div className="page-hd">
        <div className="page-title">Hangar</div>
        <div className="page-sub">
          {aircraft?.length ?? 0} aircraft under management
        </div>
      </div>

      <div className="hangar-wrap">
        {error ? (
          <div className="how-box" style={{ color: "var(--warn)" }}>
            Could not load aircraft: {error.message}
          </div>
        ) : aircraft && aircraft.length > 0 ? (
          <div className="ac-cards">
            {aircraft.map((a) => (
              <Link key={a.id} href={`/aircraft/${a.id}`} className="ac-tile">
                <div className="ac-tile-top">
                  <span className="ac-tile-pro">AIRCRAFT</span>
                  <span style={{ fontSize: 30, opacity: 0.5 }}>✈</span>
                </div>
                <div className="ac-tile-body">
                  <div className="ac-tile-reg">{a.reg}</div>
                  <div className="ac-tile-type">{a.type ?? "—"}</div>
                  <div className="ac-tile-serial">
                    {a.serial ? `S/N ${a.serial}` : ""}
                  </div>
                </div>
                <div className="ac-tile-foot">
                  <span className="mono">{a.airport ?? "—"}</span>
                </div>
              </Link>
            ))}
          </div>
        ) : (
          <div className="how-box">
            No aircraft yet. Run the import script to bring the fleet over.
          </div>
        )}
      </div>
    </>
  );
}
