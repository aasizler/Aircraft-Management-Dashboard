import { createClient } from "@/lib/supabase/server";

// Authed home. Middleware guarantees a session by the time we get here.
// Reads the fleet through RLS — the query returns only aircraft this user may
// see, with no client-side filtering. Empty result is the pre-import state.
export default async function Home() {
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();

  const { data: aircraft, error } = await supabase
    .from("aircraft")
    .select("id, reg, type, airport, maint_basis, cost_basis")
    .eq("archived", false)
    .order("sort_order");

  return (
    <main className="mx-auto max-w-4xl p-6">
      <header className="mb-6 flex items-baseline justify-between">
        <h1 className="text-2xl font-semibold">Fleet</h1>
        <span className="text-sm text-black/50 dark:text-white/50">
          {user?.email}
        </span>
      </header>

      {error ? (
        <p className="rounded-md border border-amber-500/40 bg-amber-500/10 p-4 text-sm">
          Could not load aircraft: {error.message}. If the v2 schema is not yet
          deployed, this is expected — deploy{" "}
          <code>supabase/schema_v2_tenancy.sql</code> first.
        </p>
      ) : aircraft && aircraft.length > 0 ? (
        <ul className="grid gap-3 sm:grid-cols-2">
          {aircraft.map((a) => (
            <li
              key={a.id}
              className="rounded-lg border border-black/10 p-4 dark:border-white/15"
            >
              <div className="font-mono text-lg">{a.reg}</div>
              <div className="text-sm text-black/60 dark:text-white/60">
                {a.type ?? "—"} · {a.airport ?? "—"}
              </div>
              <div className="mt-2 text-xs text-black/45 dark:text-white/45">
                maint: {a.maint_basis} · cost: {a.cost_basis}
              </div>
            </li>
          ))}
        </ul>
      ) : (
        <p className="rounded-md border border-black/10 p-4 text-sm text-black/60 dark:border-white/15 dark:text-white/60">
          No aircraft yet. Run the import script to bring the fleet over from the
          legacy app.
        </p>
      )}
    </main>
  );
}
