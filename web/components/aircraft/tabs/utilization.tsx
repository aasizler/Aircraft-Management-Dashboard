"use client";

import dynamic from "next/dynamic";
import { airportCounts, allRoutes, monthLabel, readMonthly } from "@/lib/aircraft";
import type { TabProps } from "../detail-client";
import { LabeledBarChart } from "@/components/ui/charts";
import { MaintCosts } from "../maint-costs";
import { FlightsTab } from "./flights";

// Client-only — MapLibre needs window.
const FlightMap = dynamic(
  () => import("../flight-map").then((m) => m.FlightMap),
  { ssr: false, loading: () => <div className="how-box">Loading map…</div> },
);

export function UtilizationTab(props: TabProps) {
  const { data, aircraft, maintHrs, costHrs, save, consumeAction, allow } = props;

  // v1 stores monthlyHours as a plain number array; readMonthly handles both
  // that and the {month,hours} object form. The first port assumed objects and
  // silently reported every month as zero.
  const months = readMonthly(data.monthlyHours, 6);
  const routes = allRoutes(data);
  const airports = airportCounts(data);

  const totalHours = months.reduce((s, m) => s + m.hours, 0);
  const monthlyAvg = months.length ? totalHours / months.length : 0;

  const smoh = Number(data.engineSMOH ?? 0);
  const tbo = Number(data.tbo ?? 0);
  const tt = Number(data.tt ?? maintHrs ?? 0);
  const enginePct = tbo > 0 ? Math.min(100, (smoh / tbo) * 100) : 0;
  const airframeLimit = 10000; // reference airframe life used for the v1 bar
  const airframePct = Math.min(100, (tt / airframeLimit) * 100);

  const engineColor =
    enginePct > 85 ? "var(--danger)" : enginePct > 65 ? "var(--warn)" : "var(--accent)";

  return (
    <div style={{ paddingTop: 18 }}>
      <div className="stat-row">
        <div className="stat-box">
          <div className="stat-lbl">Last 6 Mo Hours</div>
          <div className="stat-val">{totalHours.toFixed(1)}</div>
          <div className="stat-sub">flight hours</div>
        </div>
        <div className="stat-box">
          <div className="stat-lbl">Monthly Avg</div>
          <div className="stat-val">{monthlyAvg.toFixed(1)}</div>
          <div className="stat-sub">hours / month</div>
        </div>
        <div className="stat-box">
          <div className="stat-lbl">Engine TBO</div>
          <div className="stat-val" style={{ color: tbo > 0 ? engineColor : undefined }}>
            {tbo > 0 ? `${Math.round(enginePct)}%` : "—"}
          </div>
          <div className="stat-sub">
            {tbo > 0 ? `${Math.max(0, tbo - smoh).toFixed(0)} hrs left` : "TBO not set"}
          </div>
        </div>
      </div>

      <div className="two-col">
        <div className="panel">
          <div className="panel-title">Monthly Flight Hours</div>
          <LabeledBarChart
            labels={months.map((m) => monthLabel(m.month))}
            data={months.map((m) => m.hours)}
            color="var(--accent)"
          />
        </div>
        <div className="panel">
          <div className="panel-title">TBO and Overhaul Progress</div>
          <div style={{ marginTop: 6 }}>
            <div className="progress-row">
              <div className="progress-label">
                <span>Engine SMOH</span>
                <span>{tbo > 0 ? `${smoh.toFixed(0)}/${tbo} hrs` : "not set"}</span>
              </div>
              <div className="progress-track">
                <div className="progress-fill" style={{ width: `${enginePct}%`, background: engineColor }} />
              </div>
            </div>
            <div className="progress-row">
              <div className="progress-label">
                <span>Airframe Total</span>
                <span>{tt > 0 ? `${tt.toFixed(0)}/${airframeLimit} hrs` : "not set"}</span>
              </div>
              <div className="progress-track">
                <div className="progress-fill" style={{ width: `${airframePct}%`, background: "var(--accent)" }} />
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Maintenance cost tracker + expense analytics — v1 wrapped this in
          #util-financial-section and hid it from mechanic/viewer roles. */}
      {allow("financial") && (
      <MaintCosts
        data={data}
        save={save}
        reg={aircraft.reg}
        consumeAction={consumeAction}
      />
      )}

      <div className="map-section">
        <FlightMap
          routes={routes}
          airports={airports}
          reg={aircraft.reg}
          data={data}
          save={save}
        />
      </div>

      {/* Flight Log — v1 kept it at the bottom of Utilization. */}
      <FlightsTab {...props} />

      <div style={{ marginTop: 10 }} className="mono">
        cost clock: {aircraft.cost_basis} · {costHrs.toFixed(1)} hrs
      </div>
    </div>
  );
}
