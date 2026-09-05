"use client";

import {
  airworthiness, oilLife, readMonthly, SQ_LABELS,
  type DocEntry, type Insp, type MaintCost, type OilEntry, type Squawk, smohOf } from "@/lib/aircraft";
import { Icon, type IconName } from "@/components/ui/icon";
import type { TabName, TabProps } from "../detail-client";
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
  // Same judgement the hangar tile shows, from the same function — these two
  // used to work it out separately and drifted apart.
  const air = airworthiness(data, maintHrs);
  const { tracked, untracked, overdue, dueSoon, grounding } = air;

  const life = oilLife(data, maintHrs);
  const squawks = (data.squawks ?? []) as Squawk[];
  const docs = (data.documents ?? []) as DocEntry[];
  const months = readMonthly(data.monthlyHours, 6);
  const sixMoHours = months.reduce((s, m) => s + m.hours, 0);
  const { status: liveStatus, state: live } = useLivePosition(aircraft.reg);

  const smoh = smohOf(data, maintHrs);
  const tbo = Number(data.tbo ?? 0);
  const enginePct = tbo > 0 ? Math.min(100, (smoh / tbo) * 100) : 0;

  // Status ribbon — a grounding squawk outranks everything, as in v1.
  const ribbon =
    grounding.length > 0
      ? { icon: "grounded" as const, title: "Grounding Squawk Open", tone: "var(--danger)",
          sub: `${grounding.length} grounding item — ${grounding[0].desc.slice(0, 70)}` }
      : overdue.length > 0
        ? { icon: "alert" as const, title: "Attention Required", tone: "var(--danger)",
            sub: `${overdue.length} inspection${overdue.length > 1 ? "s" : ""} overdue` }
        : dueSoon.length > 0 || (life.tracked && life.pct < 15)
          ? { icon: "alert" as const, title: "Coming Due", tone: "var(--warn)",
              // Only the clauses that are actually true. "0 inspections due
              // soon" read as a warning about nothing.
              sub: [
                dueSoon.length
                  ? `${dueSoon.length} inspection${dueSoon.length > 1 ? "s" : ""} due soon`
                  : "",
                life.tracked && life.pct < 15 ? "oil life low" : "",
              ].filter(Boolean).join(" · ") }
          : tracked.length === 0
            ? { icon: "eye" as const, title: "Not Yet Tracked", tone: "var(--accent)",
                sub: "No inspection has been recorded — nothing to report on yet" }
            : { icon: "check" as const, title: "All Clear", tone: "var(--ok)",
                sub: nextLine(tracked) };

  const pctColor = (st: { s: string }) =>
    st.s === "overdue" ? "var(--danger)" : st.s === "warn" ? "var(--warn)" : "var(--accent)";

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


  // The three items closest to due, soonest first. A single hero card made the
  // least urgent thing the largest thing on the page.
  // Everything overdue or due soon, then enough of the rest to fill four rows.
  // Two sections listing the same inspections under different headings was the
  // page's largest duplication: overdue items are, by definition, also the
  // nearest ones.
  const urgent = tracked.filter((x) => x.st.s !== "ok");
  const upcoming = [...urgent, ...tracked.filter((x) => x.st.s === "ok")].slice(
    0, Math.max(4, urgent.length),
  );

  // Hours since overhaul is only a number if something recorded when the
  // overhaul was. Otherwise it is zero because nothing has been entered.
  const engineKnown = data.overhaulAt != null || data.engineSMOH != null;

  const statusTint: Record<string, string> = {
    grounded: "rgba(255,64,80,.09)",
    due: "rgba(255,160,35,.09)",
    untracked: "rgba(59,158,255,.08)",
    current: "rgba(34,226,166,.07)",
  };

  const facts: { lbl: string; val: string; sub: string; tab: TabName; tone?: string; spark?: boolean }[] = [
    ...(aircraft.cost_basis === aircraft.maint_basis
      ? [{ lbl: aircraft.maint_basis, val: maintHrs.toFixed(1),
           sub: "drives inspections, oil and billing", tab: "Utilization" as TabName }]
      : [
          { lbl: `${aircraft.maint_basis} (maint)`, val: maintHrs.toFixed(1),
            sub: "drives inspections & oil", tab: "Utilization" as TabName },
          { lbl: `${aircraft.cost_basis} (cost)`, val: costHrs.toFixed(1),
            sub: "drives billing & $/hr", tab: "Utilization" as TabName },
        ]),
    // "0%" against a TBO reads as an engine fresh off the bench. An engine with
    // no overhaul recorded has not been measured, which is a different thing.
    { lbl: "Engine", val: !engineKnown ? "—" : tbo > 0 ? `${Math.round(enginePct)}%` : smoh.toFixed(1),
      sub: !engineKnown
        ? "overhaul not recorded"
        : tbo > 0
          ? `${smoh.toFixed(1)} SMOH · ${Math.max(0, tbo - smoh).toFixed(1)} to TBO`
          : "hrs SMOH · TBO not set",
      tab: "Utilization",
      tone: engineKnown && tbo > 0
        ? enginePct > 85 ? "var(--danger)" : enginePct > 65 ? "var(--warn)" : "var(--ok)"
        : undefined },
    { lbl: "Oil life", val: life.tracked ? `${Math.round(life.pct)}%` : "—",
      sub: life.tracked ? `${life.hrsLeft.toFixed(1)} hrs left` : life.applicable ? "not tracked" : "on condition",
      tab: "Oil and Fluids",
      tone: life.tracked && life.pct < 15 ? "var(--warn)" : undefined },
    { lbl: "6-month hours", val: sixMoHours.toFixed(1), sub: "flight hours",
      tab: "Utilization", spark: true },
    { lbl: "Squawks", val: String(squawks.length), sub: "open items", tab: "Squawks",
      tone: squawks.length ? "var(--warn)" : "var(--ok)" },
    { lbl: "Documents", val: String(docs.length), sub: "on file", tab: "Documents" },
  ];

  return (
    <div className="dash-cols">
      <div>
        {/* One line, not a status card stacked on a hero card saying the same
            thing. It carries what is next rather than devoting a third of the
            page to it. */}
        <div className="dash-status" style={{ "--ds-tint": statusTint[air.level] } as React.CSSProperties}>
          <span className="ds-icon" style={{ color: ribbon.tone }}><Icon name={ribbon.icon} size={17} /></span>
          <b className="ds-title">{ribbon.title}</b>
          <span className="ds-sub">{ribbon.sub}</span>
        </div>

        {liveStatus === "airborne" && (
          <div className="adsb-banner" style={{ margin: "12px 0 0" }}>
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

        {/* Only what the ranked list below cannot carry: a grounding squawk is
            not an inspection, and an inspection that was never recorded has no
            due date to be ranked by. The overdue rows themselves used to be
            listed here and again below, under two headings. */}
        {(grounding.length > 0 || untracked.length > 0) && (
          <div className="alert-feed" style={{ marginTop: 12 }}>
            {grounding.map((sq) => (
              <div className="alert-item adanger" key={sq.id} onClick={() => go("Squawks")}>
                <div className="al-icon"><Icon name="grounded" size={17} /></div>
                <div className="al-text">
                  <div className="al-name">{sq.desc}</div>
                  <div className="al-detail">Grounding squawk · noted {sq.date}</div>
                </div>
                <div className="al-badge"><span className="badge overdue">GROUNDING</span></div>
                <div style={{ color: "var(--muted2)", fontSize: 14 }}>›</div>
              </div>
            ))}
            {untracked.length > 0 && (
              <div className="alert-item awarning" onClick={() => go("Inspections")}>
                <div className="al-icon"><Icon name="eye" size={17} /></div>
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
        )}

        {upcoming.length > 0 && (
          <>
            <div className="dash-sec-h">
              <span>Due next</span>
              <span className="sec-note">
                {tracked.length > upcoming.length
                  ? `${upcoming.length} of ${tracked.length} · soonest first`
                  : "soonest first"}
              </span>
            </div>
            <div className="due-list">
              {upcoming.map((x) => (
                <div className="due-row" key={x.i.name + x.idx} onClick={() => focusInspection(x.idx)}>
                  <div className="due-main">
                    <div className="due-name">
                      {x.i.name}
                      {x.st.s !== "ok" && (
                        <span className={`badge ${x.st.s === "overdue" ? "overdue" : "warn"}`}>
                          {x.st.s === "overdue" ? "OVERDUE" : "DUE SOON"}
                        </span>
                      )}
                    </div>
                    <div className="due-sub">
                      due {x.st.due || x.st.nl}
                      {x.i.intervalHrs ? ` · every ${x.i.intervalHrs} hrs` : ""}
                      {x.i.intervalDays ? ` · every ${monthsOf(x.i.intervalDays)}` : ""}
                    </div>
                    <span className="due-bar">
                      <i style={{ width: `${Math.min(100, x.st.p).toFixed(1)}%`, background: pctColor(x.st) }} />
                    </span>
                  </div>
                  <div className="due-rem" style={{ color: pctColor(x.st) }}>
                    <div className="due-rem-num">{x.st.remNum}</div>
                    <div className="due-rem-unit">
                      {x.st.s === "overdue" ? x.st.remFoot : x.st.remUnit || x.st.remFoot}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </>
        )}

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

      <aside className="dash-rail">
        <div className="dash-rail-acts">
          <button className="btn" onClick={() => go("Utilization", "log-flight")}>
            <Icon name="plane" size={15} />Log Flight
          </button>
          <button className="btn" onClick={() => go("Squawks", "add-squawk")}>
            <Icon name="alert" size={15} />Add Squawk
          </button>
          <button className="btn" onClick={() => go("Oil and Fluids", "log-oil")}>
            <Icon name="droplet" size={15} />Log Oil
          </button>
          <button className="btn" onClick={() => go("Oil and Fluids", "oil-change")}>
            <Icon name="wrench" size={15} />Oil Change
          </button>
        </div>

        <div className="fact-strip">
          {facts.map((f) => (
            <div className="fact" key={f.lbl} onClick={() => go(f.tab)}>
              <div className="fact-lbl">{f.lbl}</div>
              <div className="fact-val" style={{ color: f.tone }}>{f.val}</div>
              <div className="fact-sub">{f.sub}</div>
              {f.spark && <Sparkline vals={months.map((m) => m.hours)} />}
            </div>
          ))}
        </div>
      </aside>
    </div>
  );
}

/**
 * "No overdue items" says what is not wrong. The useful half of an all-clear is
 * what is closest, which the list below repeats but the line should carry.
 */
function nextLine(tracked: { i: { name: string }; st: { remNum: string | number; remUnit: string } }[]) {
  const n = tracked[0];
  if (!n) return "Aircraft is current";
  const rem = `${n.st.remNum}${n.st.remUnit ? ` ${n.st.remUnit.toLowerCase()}` : ""}`;
  return `${tracked.length} inspection${tracked.length > 1 ? "s" : ""} current · next is ${n.i.name}, ${rem} away`;
}

/** 730 → "24 months", 365 → "12 months", anything else stays in days. */
function monthsOf(days: number) {
  const m = Math.round(days / 30.44);
  return m >= 1 && Math.abs(m * 30.44 - days) < 8 ? `${m} months` : `${days} days`;
}
