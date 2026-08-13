import type { FlightEntry } from "@/lib/aircraft";
import type { TabProps } from "../detail-client";

export function UtilizationTab({ data }: TabProps) {
  const flights = (data.flights ?? []) as FlightEntry[];

  // Monthly hours: prefer stored monthlyHours, else derive from the flight log.
  const stored = (data.monthlyHours as { month: string; hours: number }[]) ?? [];
  let months: { month: string; hours: number }[];
  if (stored.length) {
    months = stored.slice(-12);
  } else {
    const agg: Record<string, number> = {};
    flights.forEach((f) => {
      const m = (f.date ?? "").slice(0, 7);
      const dur =
        f.dur ?? (f.hobbsIn != null && f.hobbsOut != null ? f.hobbsIn - f.hobbsOut : 0);
      if (m) agg[m] = (agg[m] ?? 0) + (dur || 0);
    });
    months = Object.entries(agg)
      .sort()
      .slice(-12)
      .map(([month, hours]) => ({ month, hours }));
  }
  const max = Math.max(1, ...months.map((m) => m.hours));

  // Airport counts from flight endpoints.
  const apCount: Record<string, number> = {};
  flights.forEach((f) => {
    [f.from, f.to].forEach((c) => {
      if (c) apCount[c] = (apCount[c] ?? 0) + 1;
    });
  });
  const airports = Object.entries(apCount).sort((a, b) => b[1] - a[1]);

  const total = months.reduce((s, m) => s + m.hours, 0);

  return (
    <div style={{ paddingTop: 18 }}>
      <div className="stat-row">
        <div className="stat-box">
          <div className="stat-lbl">Total Logged</div>
          <div className="stat-val">{total.toFixed(1)}</div>
          <div className="stat-sub">hours (last 12 mo)</div>
        </div>
        <div className="stat-box">
          <div className="stat-lbl">Flights</div>
          <div className="stat-val">{flights.length}</div>
          <div className="stat-sub">logged</div>
        </div>
        <div className="stat-box">
          <div className="stat-lbl">Airports</div>
          <div className="stat-val">{airports.length}</div>
          <div className="stat-sub">visited</div>
        </div>
      </div>

      <div className="panel" style={{ marginTop: 14 }}>
        <div className="panel-title">Monthly Hours</div>
        {months.length === 0 ? (
          <div style={{ color: "var(--muted2)", fontSize: 13 }}>No flight data.</div>
        ) : (
          <div style={{ display: "flex", alignItems: "flex-end", gap: 8, height: 150 }}>
            {months.map((m) => (
              <div key={m.month} style={{ flex: 1, textAlign: "center" }}>
                <div
                  style={{
                    height: `${(m.hours / max) * 120}px`,
                    background: "var(--accent)",
                    borderRadius: "4px 4px 0 0",
                    minHeight: 2,
                  }}
                  title={`${m.hours.toFixed(1)} hrs`}
                />
                <div className="mono" style={{ fontSize: 9, marginTop: 4 }}>
                  {m.month.slice(5)}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="map-section">
        <div className="section-hd">
          <span className="section-label">Airports</span>
        </div>
        <div className="ap-chips">
          {airports.length === 0 ? (
            <span className="mono">No airports yet.</span>
          ) : (
            airports.map(([code, n]) => (
              <span className="ap-chip" key={code}>
                <span className="acode">{code}</span>
                <span className="acnt">{n}</span>
              </span>
            ))
          )}
        </div>
        <div className="how-box" style={{ marginTop: 12 }}>
          <b>Flight map</b> — the interactive MapLibre map with the ADS-B track is
          being ported from the original next.
        </div>
      </div>
    </div>
  );
}
