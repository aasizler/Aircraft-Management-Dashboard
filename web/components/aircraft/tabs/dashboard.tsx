import { ic, oilLife, type Insp } from "@/lib/aircraft";
import type { TabProps } from "../detail-client";

export function DashboardTab({ data, maintHrs, costHrs, aircraft }: TabProps) {
  const active = ((data.inspections ?? []) as Insp[]).filter((i) => !i.inactive);
  const scored = active
    .map((i) => ({ i, st: ic(i, maintHrs) }))
    .sort((a, b) => b.st.p - a.st.p);
  const next = scored[0];
  const overdue = scored.filter((x) => x.st.s === "overdue").length;
  const dueSoon = scored.filter((x) => x.st.s === "warn").length;
  const life = oilLife(data, maintHrs);

  const state =
    overdue > 0
      ? { cls: "danger", icon: "⚠", title: "Attention Required", glow: "rgba(240,75,75,.18)", sub: `${overdue} inspection${overdue > 1 ? "s" : ""} overdue` }
      : dueSoon > 0 || life.pct < 15
        ? { cls: "warn", icon: "◷", title: "Coming Due", glow: "rgba(245,158,11,.18)", sub: `${dueSoon} inspection${dueSoon !== 1 ? "s" : ""} due soon${life.pct < 15 ? " · oil life low" : ""}` }
        : { cls: "ok", icon: "✓", title: "All Clear", glow: "rgba(45,212,160,.18)", sub: "No overdue items — aircraft is current" };

  const pctColor = (p: number) =>
    p >= 100 ? "var(--danger)" : p >= 80 ? "var(--warn)" : "var(--accent)";

  return (
    <div style={{ paddingTop: 18 }}>
      {/* Status card */}
      <div className="status-card" style={{ "--sc-glow": state.glow } as React.CSSProperties}>
        <span className="sc-icon">{state.icon}</span>
        <div>
          <div className="sc-title">{state.title}</div>
          <div className="sc-sub">{state.sub}</div>
        </div>
      </div>

      {/* Next due */}
      {next && next.st.remNum !== "—" && (
        <div className="next-card">
          <div className="nc-top">
            <div>
              <div className="nc-lbl">Next Inspection Due</div>
              <div className="nc-name">{next.i.name}</div>
              <div className="nc-sub">{next.st.nl}</div>
            </div>
            <div className="nc-pct-col">
              <div className="nc-pct-row">
                <span className="nc-pct-num">{next.st.remNum}</span>
                <span className="nc-pct-unit">{next.st.remUnit}</span>
              </div>
              <div className="nc-pct-foot">{next.st.remFoot || " "}</div>
            </div>
          </div>
          <div className="nc-bar">
            <i style={{ width: `${next.st.p}%`, background: pctColor(next.st.p) }} />
          </div>
        </div>
      )}

      {/* KPIs */}
      <div className="kpi-grid">
        <div className="kpi">
          <div className="kpi-lbl">{aircraft.maint_basis} (maint)</div>
          <div className="kpi-val">{maintHrs.toFixed(1)}</div>
          <div className="kpi-sub">hours</div>
        </div>
        <div className="kpi">
          <div className="kpi-lbl">{aircraft.cost_basis} (cost)</div>
          <div className="kpi-val">{costHrs.toFixed(1)}</div>
          <div className="kpi-sub">hours</div>
        </div>
        <div className="kpi">
          <div className="kpi-lbl">Oil Life</div>
          <div className="kpi-val" style={{ color: life.pct < 15 ? "var(--warn)" : undefined }}>
            {Math.round(life.pct)}%
          </div>
          <div className="kpi-sub">{life.hrsLeft.toFixed(0)} hrs left</div>
        </div>
        <div className="kpi">
          <div className="kpi-lbl">Overdue</div>
          <div className="kpi-val" style={{ color: overdue ? "var(--danger)" : undefined }}>
            {overdue}
          </div>
          <div className="kpi-sub">inspections</div>
        </div>
        <div className="kpi">
          <div className="kpi-lbl">Engine SMOH</div>
          <div className="kpi-val">{data.engineSMOH != null ? Number(data.engineSMOH).toFixed(0) : "—"}</div>
          <div className="kpi-sub">{data.tbo ? `${Number(data.tbo) - Number(data.engineSMOH ?? 0)} to TBO` : "hours"}</div>
        </div>
      </div>
    </div>
  );
}
