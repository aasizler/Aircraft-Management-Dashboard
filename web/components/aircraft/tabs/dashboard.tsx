"use client";

import {
  ic, oilLife, readMonthly, SQ_LABELS,
  type DocEntry, type Insp, type MaintCost, type OilEntry, type Squawk,
} from "@/lib/aircraft";
import { Icon, type IconName } from "@/components/ui/icon";
import type { TabProps } from "../detail-client";
import { Sparkline } from "@/components/ui/charts";
import { useLivePosition } from "@/lib/adsb";

/**
 * Dashboard, restored to v1's renderDashboard(): status ribbon, quick actions,
 * a click-through "Needs Attention" feed, KPIs that navigate, a 6-month
 * sparkline and a Recent Activity list. The first port had only a status card,
 * a next-due card and five inert KPIs — and reported "All Clear" for aircraft
 * with no recorded inspections at all.
 */
export function DashboardTab({
  data, maintHrs, costHrs, aircraft, go, focusInspection,
}: TabProps) {
  const all = (data.inspections ?? []) as Insp[];
  const active = all.map((i, idx) => ({ i, idx })).filter((x) => !x.i.inactive);
  const scored = active
    .map((x) => ({ ...x, st: ic(x.i, maintHrs) }))
    .sort((a, b) => b.st.p - a.st.p);

  const tracked = scored.filter((x) => x.st.s !== "none" && x.st.s !== "unknown");
  const untracked = scored.filter((x) => x.st.s === "none");
  const next = tracked[0];
  const overdue = tracked.filter((x) => x.st.s === "overdue");
  const dueSoon = tracked.filter((x) => x.st.s === "warn");

  const life = oilLife(data, maintHrs);
  const squawks = (data.squawks ?? []) as Squawk[];
  const grounding = squawks.filter((s) => s.status === "open");
  const docs = (data.documents ?? []) as DocEntry[];
  const months = readMonthly(data.monthlyHours, 6);
  const sixMoHours = months.reduce((s, m) => s + m.hours, 0);
  const { status: liveStatus, state: live } = useLivePosition(aircraft.reg);

  const smoh = Number(data.engineSMOH ?? 0);
  const tbo = Number(data.tbo ?? 0);
  const enginePct = tbo > 0 ? Math.min(100, (smoh / tbo) * 100) : 0;

  // Status ribbon — a grounding squawk outranks everything, as in v1.
  const ribbon =
    grounding.length > 0
      ? { icon: "grounded" as const, title: "Grounding Squawk Open", glow: "rgba(240,75,75,.18)",
          sub: `${grounding.length} grounding item — ${grounding[0].desc.slice(0, 70)}` }
      : overdue.length > 0
        ? { icon: "alert" as const, title: "Attention Required", glow: "rgba(240,75,75,.18)",
            sub: `${overdue.length} inspection${overdue.length > 1 ? "s" : ""} overdue` }
        : dueSoon.length > 0 || (life.tracked && life.pct < 15)
          ? { icon: "alert" as const, title: "Coming Due", glow: "rgba(245,158,11,.18)",
              sub: `${dueSoon.length} inspection${dueSoon.length !== 1 ? "s" : ""} due soon${life.tracked && life.pct < 15 ? " · oil life low" : ""}` }
          : tracked.length === 0
            ? { icon: "eye" as const, title: "Not Yet Tracked", glow: "rgba(59,158,255,.16)",
                sub: "No inspection has been recorded — nothing to report on yet" }
            : { icon: "check" as const, title: "All Clear", glow: "rgba(45,212,160,.18)",
                sub: "No overdue items — aircraft is current" };

  const pctColor = (p: number) =>
    p >= 100 ? "var(--danger)" : p >= 80 ? "var(--warn)" : "var(--accent)";

  // Recent activity, merged across the logs (v1 renderActivity).
  type Act = { when: string; icon: IconName; title: string; detail: string };
  const acts: Act[] = [];
  ((data.oil ?? []) as OilEntry[]).forEach((o) =>
    acts.push({
      when: o.date,
      icon: o.kind === "change" ? "wrench" : "droplet",
      title: o.kind === "change" ? "Oil change" : "Oil added",
      detail: [o.qty ? `${o.qty} qt` : "", o.type ?? "", o.notes ?? ""].filter(Boolean).join(" · "),
    }),
  );
  ((data.maintCosts ?? []) as MaintCost[]).forEach((m) =>
    acts.push({
      when: m.date,
      icon: "cash" as const,
      title: m.desc || "Maintenance cost",
      detail: [m.shop ?? "", `$${Number(m.cost).toFixed(2)}`].filter(Boolean).join(" · "),
    }),
  );
  squawks.forEach((s) =>
    acts.push({ when: s.date, icon: "alert" as const, title: SQ_LABELS[s.status], detail: s.desc }),
  );
  all.filter((i) => i.lastDate).forEach((i) =>
    acts.push({
      when: i.lastDate!,
      icon: "wrench" as const,
      title: `${i.name} complied`,
      detail: i.by ? `by ${i.by}` : "",
    }),
  );
  acts.sort((a, b) => (b.when ?? "").localeCompare(a.when ?? ""));
  const recent = acts.slice(0, 6);

  const alerts = [
    ...overdue.map((x) => ({ type: "danger" as const, name: x.i.name, detail: x.st.nl, idx: x.idx })),
    ...dueSoon.map((x) => ({ type: "warning" as const, name: x.i.name, detail: x.st.nl, idx: x.idx })),
  ];

  return (
    <div style={{ paddingTop: 16 }}>
      {/* Status ribbon */}
      <div className="status-card" style={{ "--sc-glow": ribbon.glow } as React.CSSProperties}>
        <span className="sc-icon"><Icon name={ribbon.icon} size={20} /></span>
        <div>
          <div className="sc-title">{ribbon.title}</div>
          <div className="sc-sub">{ribbon.sub}</div>
        </div>
      </div>

      {/* Live in-flight chip */}
      {liveStatus === "airborne" && (
        <div className="adsb-banner" style={{ margin: "0 0 14px" }}>
          <span className="adsb-pulse" />
          <div className="adsb-banner-main">
            <div className="adsb-banner-title">{aircraft.reg} is airborne now</div>
            <div className="adsb-banner-detail">
              {live?.alt != null ? `${live.alt.toLocaleString()} ft` : ""}
              {live?.gspd != null ? ` · ${Math.round(live.gspd)} kt` : ""}
            </div>
          </div>
          <button className="btn sm" onClick={() => go("Utilization")}>View on map</button>
        </div>
      )}

      {/* Next due */}
      {next && (
        <div
          className="next-card"
          style={{ "--nc-glow": ribbon.glow } as React.CSSProperties}
          onClick={() => focusInspection(next.idx)}
        >
          <div className="nc-top">
            <div>
              <div className="nc-lbl">Next Inspection Due</div>
              <div className="nc-name">{next.i.name}</div>
              <div className="nc-sub">{next.st.nl}</div>
            </div>
            <div className="nc-pct-col" style={{ color: pctColor(next.st.p) }}>
              <div className="nc-pct-row">
                <span className="nc-pct-num">{next.st.remNum}</span>
                {next.st.remUnit && <span className="nc-pct-unit">{next.st.remUnit}</span>}
              </div>
              {next.st.remFoot && <div className="nc-pct-foot">{next.st.remFoot}</div>}
            </div>
          </div>
          <div className="nc-bar">
            <i style={{ width: `${Math.min(100, next.st.p).toFixed(1)}%`, backgroundColor: pctColor(next.st.p) }} />
          </div>
        </div>
      )}

      {/* Quick actions */}
      <div className="dash-quick">
        <button className="dash-qbtn" onClick={() => go("Utilization", "log-flight")}>
          <span className="qi"><Icon name="plane" size={16} /></span>Log Flight
        </button>
        <button className="dash-qbtn" onClick={() => go("Squawks", "add-squawk")}>
          <span className="qi"><Icon name="alert" size={16} /></span>Add Squawk
        </button>
        <button className="dash-qbtn" onClick={() => go("Oil and Fluids", "log-oil")}>
          <span className="qi"><Icon name="droplet" size={16} /></span>Log Oil
        </button>
        <button className="dash-qbtn" onClick={() => go("Oil and Fluids", "oil-change")}>
          <span className="qi"><Icon name="wrench" size={16} /></span>Oil Change
        </button>
      </div>

      {/* Needs attention */}
      <div className="dash-sec-h">
        <span>Needs Attention</span>
        <span className="sec-note">
          {alerts.length + grounding.length === 0
            ? untracked.length
              ? `${untracked.length} inspection${untracked.length > 1 ? "s" : ""} not yet recorded`
              : "All inspections current"
            : `${alerts.length + grounding.length} item${
                alerts.length + grounding.length === 1 ? " needs" : "s need"
              } attention`}
        </span>
      </div>
      <div className="alert-feed">
        {grounding.map((s) => (
          <div className="alert-item adanger" key={s.id} onClick={() => go("Squawks")}>
            <div className="al-icon"><Icon name="grounded" size={17} /></div>
            <div className="al-text">
              <div className="al-name">{s.desc}</div>
              <div className="al-detail">Grounding squawk · noted {s.date}</div>
            </div>
            <div className="al-badge"><span className="badge overdue">GROUNDING</span></div>
            <div style={{ color: "var(--muted2)", fontSize: 14 }}>›</div>
          </div>
        ))}
        {alerts.map((al) => (
          <div
            className={`alert-item a${al.type}`}
            key={al.name + al.idx}
            onClick={() => focusInspection(al.idx)}
          >
            <div className="al-icon"><Icon name="alert" size={17} /></div>
            <div className="al-text">
              <div className="al-name">{al.name}</div>
              <div className="al-detail">{al.detail}</div>
            </div>
            <div className="al-badge">
              <span className={`badge ${al.type === "danger" ? "overdue" : "warn"}`}>
                {al.type === "danger" ? "OVERDUE" : "DUE SOON"}
              </span>
            </div>
            <div style={{ color: "var(--muted2)", fontSize: 14 }}>›</div>
          </div>
        ))}
        {alerts.length === 0 && grounding.length === 0 && untracked.length > 0 && (
          <div className="alert-item awarning" onClick={() => go("Inspections")}>
            <div className="al-icon">◌</div>
            <div className="al-text">
              <div className="al-name">
                {untracked.length} inspection{untracked.length > 1 ? "s" : ""} never recorded
              </div>
              <div className="al-detail">
                {untracked.slice(0, 3).map((x) => x.i.name).join(", ")}
                {untracked.length > 3 ? "…" : ""}
              </div>
            </div>
            <div className="al-badge"><span className="badge">NOT SET</span></div>
            <div style={{ color: "var(--muted2)", fontSize: 14 }}>›</div>
          </div>
        )}
      </div>

      {/* At a glance */}
      <div className="dash-sec-h"><span>At a Glance</span></div>
      <div className="kpi-grid">
        <div className="kpi" onClick={() => go("Utilization")}>
          <div className="kpi-lbl">6-Month Hours</div>
          <div className="kpi-val">{sixMoHours.toFixed(1)}</div>
          <div className="kpi-sub">flight hours</div>
          <Sparkline vals={months.map((m) => m.hours)} />
        </div>
        <div className="kpi" onClick={() => go("Utilization")}>
          <div className="kpi-lbl">Engine SMOH</div>
          <div
            className="kpi-val"
            style={{
              color: tbo > 0
                ? enginePct > 85 ? "var(--danger)" : enginePct > 65 ? "var(--warn)" : "var(--ok)"
                : undefined,
            }}
          >
            {tbo > 0 ? `${Math.round(enginePct)}%` : "—"}
          </div>
          <div className="kpi-sub">
            {tbo > 0 ? `${Math.max(0, tbo - smoh).toFixed(0)} hrs to TBO` : "TBO not set"}
          </div>
        </div>
        <div className="kpi" onClick={() => go("Oil and Fluids")}>
          <div className="kpi-lbl">Oil Life</div>
          <div className="kpi-val" style={{ color: life.tracked && life.pct < 15 ? "var(--warn)" : undefined }}>
            {life.tracked ? `${Math.round(life.pct)}%` : "—"}
          </div>
          <div className="kpi-sub">{life.tracked ? `${life.hrsLeft.toFixed(0)} hrs left` : "not tracked"}</div>
        </div>
        <div className="kpi" onClick={() => go("Squawks")}>
          <div className="kpi-lbl">Active Squawks</div>
          <div className="kpi-val" style={{ color: squawks.length ? "var(--warn)" : "var(--ok)" }}>
            {squawks.length}
          </div>
          <div className="kpi-sub">open items</div>
        </div>
        <div className="kpi" onClick={() => go("Documents")}>
          <div className="kpi-lbl">Documents</div>
          <div className="kpi-val">{docs.length}</div>
          <div className="kpi-sub">on file</div>
        </div>
      </div>

      <div className="dash-sec-h">
        <span>Meters</span>
        <span className="sec-note">
          maint: {aircraft.maint_basis} · cost: {aircraft.cost_basis}
        </span>
      </div>
      <div className="stat-row">
        <div className="stat-box">
          <div className="stat-lbl">{aircraft.maint_basis} (maint)</div>
          <div className="stat-val">{maintHrs.toFixed(1)}</div>
          <div className="stat-sub">drives inspections &amp; oil</div>
        </div>
        <div className="stat-box">
          <div className="stat-lbl">{aircraft.cost_basis} (cost)</div>
          <div className="stat-val">{costHrs.toFixed(1)}</div>
          <div className="stat-sub">drives billing &amp; $/hr</div>
        </div>
        <div className="stat-box">
          <div className="stat-lbl">Overdue</div>
          <div className="stat-val" style={{ color: overdue.length ? "var(--danger)" : undefined }}>
            {overdue.length}
          </div>
          <div className="stat-sub">inspections</div>
        </div>
      </div>

      {/* Recent activity */}
      <div className="dash-sec-h"><span>Recent Activity</span></div>
      <div className="act-list">
        {recent.length === 0 ? (
          <div className="act-item">
            <div className="act-main"><div className="act-d">No recent activity yet.</div></div>
          </div>
        ) : (
          recent.map((a, i) => (
            <div className="act-item" key={i}>
              <div className="act-ic"><Icon name={a.icon} size={14} /></div>
              <div className="act-main">
                <div className="act-t">{a.title}</div>
                <div className="act-d">{a.detail}</div>
              </div>
              <div className="act-time">{a.when}</div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
