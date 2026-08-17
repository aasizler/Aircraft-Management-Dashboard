"use client";

import { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { useToast } from "@/components/ui/toast";
import {
  meterValue,
  type AircraftRow,
  type Meter,
  type Squawk,
  type V1Aircraft,
} from "@/lib/aircraft";
import { can, type AppRole, type Permission } from "@/lib/permissions";
import { useAircraftRealtime } from "@/lib/realtime";
import { setAircraftPerms } from "@/lib/aircraft-perms";
import { LiveBanner } from "./live-banner";
import { MeterCapture } from "./meter-capture";
import { ManageAccess } from "./manage-access";
import { AircraftSettings } from "./aircraft-settings";
import { DashboardTab } from "./tabs/dashboard";
import { InspectionsTab } from "./tabs/inspections";
import { OilTab } from "./tabs/oil";
import { SquawksTab } from "./tabs/squawks";
import { UtilizationTab } from "./tabs/utilization";
import { ScheduleTab } from "./tabs/schedule";
import { DocumentsTab } from "./tabs/documents";
import { InsuranceTab } from "./tabs/insurance";

// Legacy tab set and order, exactly: the flight log is a section at the bottom
// of Utilization, not a tab of its own.
const TABS = [
  "Dashboard",
  "Inspections",
  "Oil and Fluids",
  "Squawks",
  "Utilization",
  "Documents",
  "Insurance",
  "Schedule",
] as const;
export type TabName = (typeof TABS)[number];

type Sync = "synced" | "syncing" | "error";

/** A quick action requested from another tab (v1's dash-quick buttons). */
export type PendingAction =
  | "log-flight" | "add-squawk" | "log-oil" | "oil-change"
  | "log-inspection" | "log-cost" | null;

type Ctx = {
  aircraft: AircraftRow;
  data: V1Aircraft;
  meters: Meter[];
  maintHrs: number;
  costHrs: number;
  save: (next: V1Aircraft) => Promise<void>;
  go: (tab: TabName, action?: PendingAction) => void;
  /**
   * One-shot read of a quick action requested from another tab. Returns true
   * (and clears it) only if the pending action is one this tab handles. Tabs
   * call it from a useState initializer, so opening the right modal needs no
   * effect and causes no cascading render.
   */
  consumeAction: (...want: PendingAction[]) => boolean;
  /** v1's can() — what this user may do with THIS aircraft. */
  role: AppRole;
  allow: (p: Permission) => boolean;
  focusInsp: number | null;
  focusInspection: (idx: number) => void;
  clearFocusInsp: () => void;
};

const AircraftCtx = createContext<Ctx | null>(null);

export function useAircraft() {
  const c = useContext(AircraftCtx);
  if (!c) throw new Error("useAircraft must be used inside AircraftDetailClient");
  return c;
}

export function AircraftDetailClient({
  aircraft,
  meters,
  role = "owner",
  shared,
  sharedBy,
  viaFleet,
  previewSave,
}: {
  aircraft: AircraftRow;
  meters: Meter[];
  role?: AppRole;
  /** Belongs to another org — someone else's record, shared with you. */
  shared?: boolean;
  sharedBy?: string | null;
  /** Fleet this aircraft belongs to, if any. */
  viaFleet?: { id: string; name: string } | null;
  previewSave?: (next: V1Aircraft) => Promise<void>;
}) {
  const [data, setData] = useState<V1Aircraft>(aircraft.data ?? {});
  const [tab, setTab] = useState<TabName>("Dashboard");

  // Insurance carries premiums, hull values and named pilots — v1 showed that
  // tab only to roles with financial access. Deriving the active tab rather
  // than storing it means a role that can't see Insurance can't be left
  // stranded there by a deep link or a revocation mid-session.
  const visibleTabs = TABS.filter((t) => t !== "Insurance" || can(role, "financial"));
  const activeTab: TabName = visibleTabs.includes(tab) ? tab : "Dashboard";

  // Tell the nav ⋮ menu what this viewer may do here. It lives in the root
  // layout, so without this it can't tell a manager from a pilot and offered
  // Aircraft Settings to both — dispatching an event at a modal that only
  // mounts for edit_settings. Retracted on unmount so the hangar's menu
  // doesn't inherit the last aircraft's answer.
  useEffect(() => {
    setAircraftPerms({
      editSettings: can(role, "edit_settings"),
      manageAccess: can(role, "manage_access"),
    });
    return () => setAircraftPerms(null);
  }, [role]);
  const [sync, setSync] = useState<Sync>("synced");
  const actionRef = useRef<PendingAction>(null);
  const [focusInsp, setFocusInsp] = useState<number | null>(null);
  const toast = useToast();

  const maintHrs = meterValue(meters, aircraft.maint_basis);
  const costHrs = meterValue(meters, aircraft.cost_basis);

  // The saveLS() replacement: persist the aircraft's data blob to ITS OWN ROW.
  // Per-aircraft rows mean concurrent edits touch disjoint rows — no more
  // fleet-blob last-write-wins. Failures now surface as a toast rather than a
  // silent red dot, and the optimistic state is rolled back.
  const save = useCallback(
    async (next: V1Aircraft) => {
      const prev = data;
      setData(next);
      if (previewSave) {
        await previewSave(next);
        return;
      }
      setSync("syncing");
      const supabase = createClient();
      // .select() to see the rowcount. RLS filters rows rather than raising, so
      // an update the policy refuses returns no error at all — which is how a
      // grant without write access could log a squawk, be told it synced, and
      // find it gone on reload.
      const { data: rows, error } = await supabase
        .from("aircraft")
        .update({ data: next })
        .eq("id", aircraft.id)
        .select("id");
      if (error) {
        setSync("error");
        setData(prev);
        toast(`Save failed: ${error.message}`, "danger");
        return;
      }
      if (!rows?.length) {
        setSync("error");
        setData(prev);
        toast("You don't have permission to change this aircraft.", "danger");
        return;
      }
      setSync("synced");
    },
    [aircraft.id, previewSave, data, toast],
  );

  // Another manager editing this aircraft updates our copy live (v1
  // handleRealtimeFleetUpdate). Skipped in the preview harness.
  //
  // Postgres echoes your OWN update back down the channel, and the payload
  // says nothing about who made it — so every save announced "Updated by
  // another user" to the person who had just pressed save. v1 compared the
  // incoming blob with the local one and returned early when they matched;
  // same test here, against a ref so the callback always sees current data.
  const dataRef = useRef(data);
  dataRef.current = data;
  const remoteRef = useRef<(next: Record<string, unknown>) => void>(() => {});
  remoteRef.current = (next: Record<string, unknown>) => {
    if (JSON.stringify(next) === JSON.stringify(dataRef.current)) return;
    setData(next as V1Aircraft);
    toast("Updated by another user", "info");
  };
  useAircraftRealtime(previewSave ? "" : aircraft.id, (d) => remoteRef.current(d));

  const go = useCallback((t: TabName, a: PendingAction = null) => {
    actionRef.current = a;
    setTab(t);
  }, []);

  const consumeAction = useCallback((...want: PendingAction[]) => {
    if (actionRef.current && want.includes(actionRef.current)) {
      actionRef.current = null;
      return true;
    }
    return false;
  }, []);

  const ctx: Ctx = {
    aircraft, data, meters, maintHrs, costHrs, save, go, consumeAction,
    role,
    allow: (p: Permission) => can(role, p),
    focusInsp,
    // Deep-link from the dashboard into a specific inspection row (v1 preInsp).
    focusInspection: (idx: number) => { setTab("Inspections"); setFocusInsp(idx); },
    clearFocusInsp: () => setFocusInsp(null),
  };

  // Hero facts, ported from renderHero(): type, serial, squawk state, airport,
  // total time, SMOH and the maintenance clock.
  const openSquawks = ((data.squawks ?? []) as Squawk[]).length;
  const grounding = ((data.squawks ?? []) as Squawk[]).some((s) => s.status === "open");

  return (
    <AircraftCtx.Provider value={ctx}>
      <div id="page-scroll">
        <div className="breadcrumb">
          <Link href="/">Hangar</Link>
          <span>›</span>
          <span>{aircraft.reg}</span>
        </div>

        {/* Hero banner */}
        <div className="hero-banner" style={{ marginTop: 12 }}>
          <span className="hero-reg-sm">{aircraft.reg}</span>
          {/* v1's renderHero() badged every aircraft SHARED or LOCAL. Only the
              shared case is worth the space — a registration is unique within
              an org, not across them, so two aircraft can read the same tail
              and this is what tells them apart once you've clicked in. */}
          {shared && (
            <span
              className="hero-badge shared"
              title={sharedBy ? `Shared by ${sharedBy}` : "Shared with you"}
            >
              SHARED
            </span>
          )}
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
            {openSquawks > 0 && (
              <span
                className="hero-chip"
                style={{ color: grounding ? "var(--danger)" : "var(--warn)", cursor: "pointer" }}
                onClick={() => go("Squawks")}
              >
                <span
                  className="status-dot"
                  style={{ background: grounding ? "var(--danger)" : "var(--warn)" }}
                />
                {grounding ? "Squawk Open" : `${openSquawks} Squawk${openSquawks > 1 ? "s" : ""}`}
              </span>
            )}
            {aircraft.airport && (
              <span className="hero-chip">
                <span className="status-dot" /> {aircraft.airport}
              </span>
            )}
            {data.tt != null && (
              <span className="hero-chip">
                TT <b>{Number(data.tt).toFixed(0)}</b> hrs
              </span>
            )}
            {data.engineSMOH != null && (
              <span className="hero-chip">
                SMOH <b>{Number(data.engineSMOH).toFixed(0)}</b> hrs
              </span>
            )}
            <span className="hero-chip">
              {aircraft.maint_basis} <b>{maintHrs.toFixed(1)}</b> hrs
            </span>
          </div>
          {typeof data.lastUpdated === "string" && data.lastUpdated && (
            <span className="last-sync">{data.lastUpdated}</span>
          )}
          <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
            {/* Aircraft Settings and Manage Access live in the nav ⋮ menu and the
                hangar tile menu, as they did in v1 — the hero stays uncluttered. */}
            {!previewSave && can(role, "edit_settings") && (
              <AircraftSettings aircraft={aircraft} meters={meters} data={data} save={save} hidden />
            )}
            {!previewSave && can(role, "manage_access") && (
              <ManageAccess aircraftId={aircraft.id} orgId={aircraft.org_id} reg={aircraft.reg} viaFleet={viaFleet} hidden />
            )}
            {!previewSave && <MeterCapture aircraft={aircraft} />}
            <span className={`sync-badge ${sync}`}>
              <span className="sync-dot" />
              {sync === "syncing" ? "Saving…" : sync === "error" ? "Error" : "Synced"}
            </span>
          </div>
        </div>

        {/* Live ADS-B (skipped in preview harness to avoid network polling) */}
        {!previewSave && <LiveBanner reg={aircraft.reg} aircraftId={aircraft.id} data={data} save={save} />}

        {/* Tab bar. v1 hid the Insurance button outright for roles without
            financial access and refused to navigate there; the port showed it
            to everyone, including pilots and mechanics. */}
        <div className="tabs">
          {visibleTabs.map((t) => (
            <button
              key={t}
              className={`tab ${activeTab === t ? "active" : ""}`}
              onClick={() => setTab(t)}
            >
              {t}
              {t === "Squawks" && openSquawks > 0 && (
                <span
                  className="sq-dot"
                  style={{
                    background: grounding ? "var(--danger)" : "var(--warn)",
                    marginLeft: 6,
                    verticalAlign: "middle",
                  }}
                />
              )}
            </button>
          ))}
        </div>

        <div className="tab-content">
          {activeTab === "Dashboard" && <DashboardTab {...ctx} />}
          {activeTab === "Inspections" && <InspectionsTab {...ctx} />}
          {activeTab === "Oil and Fluids" && <OilTab {...ctx} />}
          {activeTab === "Squawks" && <SquawksTab {...ctx} />}
          {activeTab === "Utilization" && <UtilizationTab {...ctx} />}
          {activeTab === "Schedule" && <ScheduleTab {...ctx} />}
          {activeTab === "Documents" && <DocumentsTab {...ctx} />}
          {activeTab === "Insurance" && <InsuranceTab {...ctx} />}
        </div>
      </div>
    </AircraftCtx.Provider>
  );
}

export type TabProps = {
  aircraft: AircraftRow;
  data: V1Aircraft;
  meters: Meter[];
  maintHrs: number;
  costHrs: number;
  save: (next: V1Aircraft) => Promise<void>;
  go: (tab: TabName, action?: PendingAction) => void;
  consumeAction: (...want: PendingAction[]) => boolean;
  /** v1's can() — what this user may do with THIS aircraft. */
  role: AppRole;
  allow: (p: Permission) => boolean;
  focusInsp: number | null;
  focusInspection: (idx: number) => void;
  clearFocusInsp: () => void;
};
