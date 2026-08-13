import Link from "next/link";
import { createClient } from "@/lib/supabase/server";

// Authed home. Middleware guarantees a session by the time we get here.
// Reads the fleet through RLS — returns only aircraft this user may see.
export default async function Home() {
  const supabase = await createClient();

  const { data: aircraft, error } = await supabase
    .from("aircraft")
    .select("id, reg, type, airport, maint_basis, cost_basis")
    .eq("archived", false)
    .order("sort_order");

  return (
    <main className="mx-auto w-full max-w-5xl px-7 py-8">
      <header className="mb-6 flex items-baseline justify-between">
        <h1 className="at-title">Fleet</h1>
        <span className="at-mono">{aircraft?.length ?? 0} aircraft</span>
      </header>

      {error ? (
        <p className="at-card" style={{ color: "var(--warn)" }}>
          Could not load aircraft: {error.message}
        </p>
      ) : aircraft && aircraft.length > 0 ? (
        <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {aircraft.map((a) => (
            <li key={a.id}>
              <Link href={`/aircraft/${a.id}`} className="at-card at-card-hover block">
                <div className="flex items-center gap-2">
                  <span className="at-dot" />
                  <span
                    className="font-mono text-lg font-semibold"
                    style={{ letterSpacing: "0.04em" }}
                  >
                    {a.reg}
                  </span>
                </div>
                <div className="mt-1 text-sm" style={{ color: "var(--muted2)" }}>
                  {a.type ?? "—"}
                </div>
                <div className="mt-0.5 text-sm" style={{ color: "var(--muted)" }}>
                  {a.airport ?? "—"}
                </div>
                <div className="mt-3 flex gap-1.5">
                  <span className="at-badge info">MAINT · {a.maint_basis}</span>
                  <span className="at-badge info">COST · {a.cost_basis}</span>
                </div>
              </Link>
            </li>
          ))}
        </ul>
      ) : (
        <p className="at-card" style={{ color: "var(--muted2)" }}>
          No aircraft yet. Run the import script to bring the fleet over.
        </p>
      )}
    </main>
  );
}
