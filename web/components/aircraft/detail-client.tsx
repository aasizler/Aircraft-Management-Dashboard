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
import { LiveBanner } from "./live-banner";
import { MeterCapture } from "./meter-capture";
import { ManageAccess } from "./manage-access";
import { DashboardTab } from "./tabs/dashboard";
import { InspectionsTab } from "./tabs/inspections";
import { OilTab } from "./tabs/oil";
import { UtilizationTab } from "./tabs/utilization";
import { FlightsTab } from "./tabs/flights";
import { ScheduleTab } from "./tabs/schedule";
import { DocumentsTab } from "./tabs/documents";
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
  canManage,
  previewSave,
}: {
  aircraft: AircraftRow;
  meters: Meter[];
  canManage?: boolean;
  previewSave?: (next: V1Aircraft) => Promise<void>;
}) {
  const [data, setData] = useState<V1Aircraft>(aircraft.data ?? {});
  const [tab, setTab] = useState<TabName>("Dashboard");
  const [sync, setSync] = useState<Sync>("synced");

  const maintHrs = meterValue(meters, aircraft.maint_basis);
  const costHrs = meterValue(meters, aircraft.cost_basis);

  // The saveLS() replacement: persist the aircraft's data blob to ITS OWN ROW.
  // Per-aircraft rows mean concurrent edits touch disjoint rows — no more
  // fleet-blob last-write-wins. previewSave short-circuits DB writes for the
  // mock harness.
  const save = useCallback(
    async (next: V1Aircraft) => {
      setData(next);
      if (previewSave) {
        await previewSave(next);
        return;
      }
      setSync("syncing");
      const supabase = createClient();
      const { error } = await supabase
        .from("aircraft")
        .update({ data: next })
        .eq("id", aircraft.id);
      setSync(error ? "error" : "synced");
    },
    [aircraft.id, previewSave],
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
        <div style={{ marginLeft: "auto", display: "flex", gap: 8, alignItems: "center" }}>
          {!previewSave && canManage && (
            <ManageAccess aircraftId={aircraft.id} orgId={aircraft.org_id} reg={aircraft.reg} />
          )}
          {!previewSave && <MeterCapture aircraft={aircraft} />}
          <span className={`sync-badge ${sync}`}>
            <span className="sync-dot" />
            {sync === "syncing" ? "Saving…" : sync === "error" ? "Error" : "Synced"}
          </span>
        </div>
      </div>

      {/* Live ADS-B (skipped in preview harness to avoid network polling) */}
      {!previewSave && <LiveBanner reg={aircraft.reg} />}

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
        {tab === "Dashboard" && <DashboardTab {...ctx} />}
        {tab === "Inspections" && <InspectionsTab {...ctx} />}
        {tab === "Oil" && <OilTab {...ctx} />}
        {tab === "Utilization" && <UtilizationTab {...ctx} />}
        {tab === "Flights" && <FlightsTab {...ctx} />}
        {tab === "Schedule" && <ScheduleTab {...ctx} />}
        {tab === "Documents" && <DocumentsTab {...ctx} />}
        {tab === "Insurance" && <InsuranceTab {...ctx} />}
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
