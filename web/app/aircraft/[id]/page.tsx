import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import type { MeterKind } from "@/lib/types";

// v1 inspection shape, carried along inside aircraft.data.
type Insp = {
  name: string;
  lastDate?: string | null;
  lastHobbs?: number | null;
  intervalHrs?: number | null;
  intervalDays?: number | null;
  populated?: boolean;
  inactive?: boolean;
};

function fmt(n: number | null | undefined, unit = "") {
  if (n == null || Number.isNaN(n)) return "—";
  return `${Math.round(n * 10) / 10}${unit}`;
}

// Status of one inspection against the CORRECT clock (maintHrs), not max(hobbs,tt).
function inspStatus(i: Insp, maintHrs: number) {
  if (i.intervalHrs && i.lastHobbs != null) {
    const remaining = i.lastHobbs + i.intervalHrs - maintHrs;
    return {
      remaining,
      label: `${fmt(remaining, " hrs")} left`,
      overdue: remaining <= 0,
      due: remaining <= (i.intervalHrs ? i.intervalHrs * 0.1 : 5),
    };
  }
  if (i.intervalDays && i.lastDate) {
    const next = new Date(i.lastDate);
    next.setDate(next.getDate() + i.intervalDays);
    const days = Math.round((+next - Date.now()) / 86_400_000);
    return {
      remaining: days,
      label: `${days} days left`,
      overdue: days <= 0,
      due: days <= 30,
    };
  }
  return { remaining: Infinity, label: "—", overdue: false, due: false };
}

export default async function AircraftDetail({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();

  const { data: a } = await supabase
    .from("aircraft")
    .select("id, reg, type, airport, serial, maint_basis, cost_basis, data")
    .eq("id", id)
    .single();

  if (!a) notFound();

  const { data: meters } = await supabase
    .from("aircraft_meters")
    .select("kind, current, label")
    .eq("aircraft_id", id);

  const meterOf = (k: MeterKind) =>
    meters?.find((m) => m.kind === k)?.current ?? null;
  const maintHrs = meterOf(a.maint_basis as MeterKind) ?? 0;

  const detail = (a.data ?? {}) as Record<string, unknown>;
  const inspections = ((detail.inspections as Insp[]) ?? []).filter(
    (i) => i.populated && !i.inactive,
  );
  const smoh = detail.engineSMOH as number | undefined;
  const tbo = detail.tbo as number | undefined;

  return (
    <main className="mx-auto w-full max-w-5xl px-7 py-8">
      <Link href="/" className="at-mono hover:text-[var(--accent)]">
        ← Fleet
      </Link>

      <header className="mt-3 mb-6">
        <h1
          className="font-mono text-3xl font-semibold"
          style={{ letterSpacing: "0.04em" }}
        >
          {a.reg}
        </h1>
        <p className="mt-1" style={{ color: "var(--muted2)" }}>
          {a.type ?? "—"} · {a.airport ?? "—"}
          {a.serial ? ` · S/N ${a.serial}` : ""}
        </p>
        <div className="mt-3 flex gap-1.5">
          <span className="at-badge info">MAINT CLOCK · {a.maint_basis}</span>
          <span className="at-badge info">COST CLOCK · {a.cost_basis}</span>
        </div>
      </header>

      {/* Meter tiles */}
      <section className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
        {(meters ?? []).map((m) => (
          <div key={m.kind} className="at-card">
            <div className="at-stat-lbl">{m.label ?? m.kind}</div>
            <div className="at-stat-val font-mono">{fmt(m.current)}</div>
          </div>
        ))}
        {smoh != null && (
          <div className="at-card">
            <div className="at-stat-lbl">Engine SMOH</div>
            <div className="at-stat-val font-mono">{fmt(smoh)}</div>
            {tbo ? (
              <div className="at-mono mt-1">{fmt(tbo - smoh, " hrs")} to TBO</div>
            ) : null}
          </div>
        )}
      </section>

      {/* Inspections — computed against the maintenance clock */}
      <section>
        <h2 className="at-title mb-3 text-lg">Inspections</h2>
        {inspections.length === 0 ? (
          <p className="at-card" style={{ color: "var(--muted2)" }}>
            No populated inspections carried over.
          </p>
        ) : (
          <ul className="at-card divide-y" style={{ borderColor: "var(--border2)", padding: 0 }}>
            {inspections.map((i, idx) => {
              const s = inspStatus(i, maintHrs);
              const color = s.overdue
                ? "var(--danger)"
                : s.due
                  ? "var(--warn)"
                  : "var(--ok)";
              return (
                <li
                  key={idx}
                  className="flex items-center justify-between px-4 py-3"
                  style={{ borderColor: "var(--border2)" }}
                >
                  <span className="text-sm">{i.name}</span>
                  <span className="font-mono text-sm" style={{ color }}>
                    {s.label}
                  </span>
                </li>
              );
            })}
          </ul>
        )}
        <p className="at-mono mt-2" style={{ color: "var(--muted)" }}>
          Hours-based inspections measured against the <b>{a.maint_basis}</b>{" "}
          meter ({fmt(maintHrs, " hrs")}).
        </p>
      </section>
    </main>
  );
}
