"use client";

import { useCallback, useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import {
  meterValue,
  type AircraftRow,
  type Meter,
  type V1Aircraft,
} from "@/lib/aircraft";
import { InspectionsTab } from "./tabs/inspections";
import { OilTab } from "./tabs/oil";
import { FlightsTab } from "./tabs/flights";
import { ScheduleTab } from "./tabs/schedule";
import { InsuranceTab } from "./tabs/insurance";

const TABS = [
  "Dashboard",
  "Inspections",
  "Oil",
  "Utilization",
  "Flights",
  "Schedule",
  "Documents",
  "Insurance",
] as const;
type TabName = (typeof TABS)[number];

type Sync = "synced" | "syncing" | "error";

export function AircraftDetailClient({
  aircraft,
  meters,
}: {
  aircraft: AircraftRow;
  meters: Meter[];
}) {
  const [data, setData] = useState<V1Aircraft>(aircraft.data ?? {});
  const [tab, setTab] = useState<TabName>("Inspections");
  const [sync, setSync] = useState<Sync>("synced");

  const maintHrs = meterValue(meters, aircraft.maint_basis);
  const costHrs = meterValue(meters, aircraft.cost_basis);

  // The saveLS() replacement: persist the aircraft's data blob to ITS OWN ROW.
  // Per-aircraft rows mean concurrent edits touch disjoint rows — no more
  // fleet-blob last-write-wins.
  const save = useCallback(
    async (next: V1Aircraft) => {
      setData(next);
      setSync("syncing");
      const supabase = createClient();
      const { error } = await supabase
        .from("aircraft")
        .update({ data: next })
        .eq("id", aircraft.id);
      setSync(error ? "error" : "synced");
    },
    [aircraft.id],
  );

  const ctx = { aircraft, data, meters, maintHrs, costHrs, save };

  return (
    <div id="page-scroll">
      <div className="breadcrumb">
        <Link href="/">Hangar</Link>
        <span>›</span>
        <span>{aircraft.reg}</span>
      </div>

      {/* Hero banner */}
      <div className="hero-banner" style={{ marginTop: 12 }}>
        <span className="hero-reg-sm">{aircraft.reg}</span>
        <span className="hero-divider" />
        <div className="hero-chips">
          <span className="hero-chip">
            <b>{aircraft.type ?? "—"}</b>
          </span>
          {aircraft.serial && (
            <span className="hero-chip">
              S/N <b>{aircraft.serial}</b>
            </span>
          )}
          <span className="hero-chip">
            <span className="status-dot" /> {aircraft.airport ?? "—"}
          </span>
          <span className="hero-chip">
            {aircraft.maint_basis} <b>{maintHrs.toFixed(1)}</b> hrs
          </span>
        </div>
        <span className={`sync-badge ${sync}`}>
          <span className="sync-dot" />
          {sync === "syncing" ? "Saving…" : sync === "error" ? "Error" : "Synced"}
        </span>
      </div>

      {/* Tab bar */}
      <div className="tabs">
        {TABS.map((t) => (
          <button
            key={t}
            className={`tab ${tab === t ? "active" : ""}`}
            onClick={() => setTab(t)}
          >
            {t}
          </button>
        ))}
      </div>

      <div className="tab-content">
        {tab === "Inspections" && <InspectionsTab {...ctx} />}
        {tab === "Oil" && <OilTab {...ctx} />}
        {tab === "Flights" && <FlightsTab {...ctx} />}
        {tab === "Schedule" && <ScheduleTab {...ctx} />}
        {tab === "Insurance" && <InsuranceTab {...ctx} />}
        {(tab === "Dashboard" ||
          tab === "Utilization" ||
          tab === "Documents") && (
          <div className="how-box" style={{ marginTop: 18 }}>
            <b>{tab}</b> — porting in progress. Inspections, Oil, Flights,
            Schedule, and Insurance are live.
          </div>
        )}
      </div>
    </div>
  );
}

export type TabProps = {
  aircraft: AircraftRow;
  data: V1Aircraft;
  meters: Meter[];
  maintHrs: number;
  costHrs: number;
  save: (next: V1Aircraft) => Promise<void>;
};
