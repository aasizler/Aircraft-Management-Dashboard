import { oilLife, type OilEntry } from "@/lib/aircraft";
import type { TabProps } from "../detail-client";

export function OilTab({ data, maintHrs }: TabProps) {
  const entries = (data.oil ?? []) as OilEntry[];
  const life = oilLife(data, maintHrs);
  const barColor =
    life.pct <= 0 ? "var(--danger)" : life.pct < 15 ? "var(--warn)" : "var(--ok)";

  return (
    <>
      <div className="stat-row">
        <div className="stat-box">
          <div className="stat-lbl">Oil Life</div>
          <div className="stat-val" style={{ color: barColor }}>
            {Math.round(life.pct)}%
          </div>
          <div className="stat-sub">
            {life.hrsLeft >= 0
              ? `${life.hrsLeft.toFixed(1)} hrs to next change`
              : `${life.overdueHrs.toFixed(1)} hrs overdue`}
          </div>
        </div>
        <div className="stat-box">
          <div className="stat-lbl">Interval</div>
          <div className="stat-val">{life.interval}</div>
          <div className="stat-sub">hours between changes</div>
        </div>
        <div className="stat-box">
          <div className="stat-lbl">Used Since Change</div>
          <div className="stat-val">{life.used.toFixed(1)}</div>
          <div className="stat-sub">hours</div>
        </div>
      </div>

      <div className="panel" style={{ marginTop: 14 }}>
        <div className="panel-title">Oil Log</div>
        <ul className="log-list">
          {entries.length === 0 ? (
            <li className="log-item" style={{ color: "var(--muted2)" }}>
              No oil entries.
            </li>
          ) : (
            entries.map((e, idx) => (
              <li className="log-item" key={idx}>
                <span className="log-date">{e.date}</span>
                <span className="log-qty">
                  {e.kind === "change" ? "CHG" : e.qty != null ? `${e.qty} qt` : ""}
                </span>
                <span className="log-note">
                  {e.type ?? ""}
                  {e.hobbs != null ? ` · ${e.hobbs} hrs` : ""}
                  {e.notes ? ` · ${e.notes}` : ""}
                </span>
              </li>
            ))
          )}
        </ul>
      </div>
    </>
  );
}
