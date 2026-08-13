import type { FlightEntry } from "@/lib/aircraft";
import type { TabProps } from "../detail-client";

export function FlightsTab({ data }: TabProps) {
  const flights = (data.flights ?? []) as FlightEntry[];

  return (
    <div className="panel" style={{ marginTop: 18 }}>
      <div className="panel-title">Flight Log</div>
      {flights.length === 0 ? (
        <div style={{ color: "var(--muted2)", fontSize: 13 }}>
          No flights logged.
        </div>
      ) : (
        flights.map((f, idx) => {
          const dur =
            f.dur ??
            (f.hobbsIn != null && f.hobbsOut != null
              ? f.hobbsIn - f.hobbsOut
              : null);
          return (
            <div className="flight-entry" key={idx}>
              <span className="fl-date">{f.date}</span>
              <span className="fl-route">
                {(f.from ?? "—") + " → " + (f.to ?? "—")}
              </span>
              <span className="fl-dur">
                {dur != null ? `${dur.toFixed(1)}h` : "—"}
              </span>
              <span className="fl-rem">{f.notes ?? ""}</span>
            </div>
          );
        })
      )}
    </div>
  );
}
