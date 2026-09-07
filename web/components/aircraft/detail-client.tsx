"use client";

import { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { useToast } from "@/components/ui/toast";
import {
  meterValue,
  type AircraftRow,
  type Meter,
  type Squawk,
  type V1Aircraft,
  canonical,
  smohOf,
} from "@/lib/aircraft";
import { can, type AppRole, type Permission } from "@/lib/permissions";
import { useAircraftRealtime } from "@/lib/realtime";
import { setAircraftPerms } from "@/lib/aircraft-perms";
import { useLivePosition, type Landing, type LiveSource, type LiveState, type LiveStatus, type TrackPoint } from "@/lib/adsb";
import { useWhere } from "@/lib/where";
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
  | "log-inspection" | "log-cost"
  /** Opened from a signal glyph: go to Utilization and show the map. */
  | "view-map"
  | null;

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
  /**
   * The page's one ADS-B poller. useLivePosition polls every 10s per mount, and
   * this page had grown three of them for the same tail — the hero's location,
   * the live row and the dashboard's airborne chip — with a fourth arriving
   * whenever the map opened. Four mounts is 24 requests a minute for one
   * aeroplane, which is how an app gets rate-limited off a free feed. Poll here,
   * read everywhere.
   */
  live: { status: LiveStatus; state: LiveState | null; track: TrackPoint[]; source: LiveSource | null };
  /**
   * Register the landing handler. Only the live row wants one — it is what
   * offers to log the flight — so it registers on mount and clears on unmount
   * rather than every consumer carrying a callback it has no use for.
   */
  onLanding: (cb: ((l: Landing) => void) | null) => void;
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
  /**
   * Deep link into a tab — the hangar's signal control sends an airborne
   * aircraft straight to its map. Read at initialisation rather than in an
   * effect, so the right tab renders on the first pass instead of flashing the
   * dashboard and cascading a second render.
   */
  // useSearchParams rather than window.location: on a soft navigation from the
  // hangar the component mounts before the browser URL has been updated, so
  // reading location.search in an initializer saw the hangar's URL and opened
  // the Dashboard with ?tab=Utilization sitting in the address bar.
  const params = useSearchParams();
  const [tab, setTab] = useState<TabName>(() => {
    const want = params.get("tab");
    return TABS.find((t) => t.toLowerCase() === want?.toLowerCase()) ?? "Dashboard";
  });

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
  /**
   * A signal glyph brought us here to see the flight, not the tab. Held as
   * state on the page rather than consumed by the tab: a useState initializer
   * runs twice in development and the second call found the action already
   * taken, so the scroll never happened. This is idempotent — scrolling to the
   * same place twice is the same as once.
   */
  const [scrollTo, setScrollTo] = useState<"map" | null>(() =>
    params.get("at") === "map" ? "map" : null,
  );
  useEffect(() => {
    if (scrollTo !== "map" || tab !== "Utilization") return;
    // Instant rather than smooth: MapLibre and the airport database pin the
    // main thread for a second or more on first open, and a smooth scroll never
    // gets a frame to run in — measured 100ms timers firing 1000ms apart.
    //
    // And not once. On a tab switch the charts and cost table above the map
    // are still laying out when the first scroll lands, so the map moves down
    // afterwards and the viewport is left on the section above it — measured
    // landing at 996 for a map that settled at 1439. Follow the layout for a
    // bounded window: re-scroll whenever the page grows, then stop.
    const jump = () =>
      document.getElementById("flight-map")?.scrollIntoView({ behavior: "auto", block: "start" });
    const first = window.setTimeout(jump, 200);
    const ro = new ResizeObserver(jump);
    ro.observe(document.body);
    const done = window.setTimeout(() => { ro.disconnect(); setScrollTo(null); }, 1500);
    return () => { window.clearTimeout(first); window.clearTimeout(done); ro.disconnect(); };
  }, [scrollTo, tab]);
  const [focusInsp, setFocusInsp] = useState<number | null>(null);
  const toast = useToast();

  const maintHrs = meterValue(meters, aircraft.maint_basis, data.tt);
  const costHrs = meterValue(meters, aircraft.cost_basis, data.tt);

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
  //
  // The stringify comparison was still wrong: Postgres stores jsonb with its
  // own key order (by length, then bytewise), so the blob that comes back down
  // the channel almost never serialises identically to the local object even
  // when the two are equal. Every save announced itself as someone else's edit.
  // Compare canonically — keys sorted at every level — instead.
  const dataRef = useRef(data);
  dataRef.current = data;
  const remoteRef = useRef<(next: Record<string, unknown>) => void>(() => {});
  remoteRef.current = (next: Record<string, unknown>) => {
    if (canonical(next) === canonical(dataRef.current)) return;
    setData(next as V1Aircraft);
    toast("Updated by another user", "info");
  };
  useAircraftRealtime(previewSave ? "" : aircraft.id, (d) => remoteRef.current(d));

  /**
   * Every tab change goes through here, and every one leaves a history entry —
   * so the browser's back button walks back through the tabs you visited and
   * only then leaves the aeroplane, which is what a tabbed page does everywhere
   * else. It used to exit to the hangar from any tab, losing the whole trail.
   *
   * history.pushState rather than router.push: the tab is entirely client
   * state, and a router navigation would re-run the server component and
   * refetch the aircraft on every click of the tab bar.
   */
  const openTab = useCallback((t: TabName) => {
    // Compared against the URL, not against state, and pushed outside the
    // updater: React may run a setState updater more than once, and it does in
    // development, so pushing from inside it left two history entries per click
    // and made Back need two presses per tab.
    const cur = new URLSearchParams(window.location.search).get("tab") ?? "Dashboard";
    if (cur.toLowerCase() !== t.toLowerCase()) {
      const url = new URL(window.location.href);
      if (t === "Dashboard") url.searchParams.delete("tab");
      else url.searchParams.set("tab", t);
      window.history.pushState(null, "", url);
    }
    setTab(t);
  }, []);

  // Back and forward put the URL where it was; follow it.
  useEffect(() => {
    const onPop = () => {
      const want = new URLSearchParams(window.location.search).get("tab");
      setTab(TABS.find((t) => t.toLowerCase() === want?.toLowerCase()) ?? "Dashboard");
    };
    window.addEventListener("popstate", onPop);
    return () => window.removeEventListener("popstate", onPop);
  }, []);

  const go = useCallback((t: TabName, a: PendingAction = null) => {
    if (a === "view-map") setScrollTo("map");
    else actionRef.current = a;
    openTab(t);
  }, [openTab]);

  const consumeAction = useCallback((...want: PendingAction[]) => {
    if (actionRef.current && want.includes(actionRef.current)) {
      actionRef.current = null;
      return true;
    }
    return false;
  }, []);

  const landingCb = useRef<((l: Landing) => void) | null>(null);
  const onLanding = useCallback((cb: ((l: Landing) => void) | null) => {
    landingCb.current = cb;
  }, []);
  const handleLanding = useCallback((l: Landing) => landingCb.current?.(l), []);
  const live = useLivePosition(previewSave ? "" : aircraft.reg, handleLanding);
  const where = useWhere(live.status, live.state, aircraft.airport);

  const ctx: Ctx = {
    aircraft, data, meters, maintHrs, costHrs, save, go, consumeAction, live, onLanding,
    role,
    allow: (p: Permission) => can(role, p),
    focusInsp,
    // Deep-link from the dashboard into a specific inspection row (v1 preInsp).
    focusInspection: (idx: number) => { openTab("Inspections"); setFocusInsp(idx); },
    clearFocusInsp: () => setFocusInsp(null),
  };

  // Hero facts, ported from renderHero(): type, serial, squawk state, airport,
  // total time, SMOH and the maintenance clock.
  const openSquawks = ((data.squawks ?? []) as Squawk[]).length;
  // Skipped in the preview harness for the same reason the live banner is:
  // no network polling.
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
          <div className="hero-id">
            <div className="hero-reg-row">
              <span className="hero-reg-sm">{aircraft.reg}</span>
              {/* v1's renderHero() badged every aircraft SHARED or LOCAL. Only
                  the shared case is worth the space — a registration is unique
                  within an org, not across them, so two aircraft can read the
                  same tail and this is what tells them apart once you've
                  clicked in. */}
              {shared && (
                <span
                  className="hero-badge shared"
                  title={sharedBy ? `Shared by ${sharedBy}` : "Shared with you"}
                >
                  SHARED
                </span>
              )}
            </div>

          {/* Identity on one quiet line under the registration, and the clocks
              as figures rather than footnotes. Everything used to sit at 11px
              in one wrapping row, so the model, the serial and three live hour
              readings all carried the same weight. */}
          <div className="hero-ident">
            <span className="hero-type">{aircraft.type ?? "—"}</span>
            {aircraft.serial && <span className="hero-sn">S/N {aircraft.serial}</span>}
            {where && (
              <span
                className={where.live ? "hero-where live" : "hero-where"}
                title={where.title}
                onClick={where.live ? () => go("Utilization") : undefined}
              >
                {where.label}
              </span>
            )}
            {openSquawks > 0 && (
              <span
                className="hero-sq"
                style={{ color: grounding ? "var(--danger)" : "var(--warn)" }}
                onClick={() => go("Squawks")}
              >
                {grounding ? "Squawk open" : `${openSquawks} squawk${openSquawks > 1 ? "s" : ""}`}
              </span>
            )}
          </div>
          </div>

          <div className="hero-nums">
            <div className="hero-num">
              <div className="hn-k">{aircraft.maint_basis}</div>
              <div className="hn-v">{maintHrs.toFixed(1)}</div>
            </div>
            {aircraft.cost_basis !== aircraft.maint_basis && (
              <div className="hero-num">
                <div className="hn-k">{aircraft.cost_basis}</div>
                <div className="hn-v">{costHrs.toFixed(1)}</div>
              </div>
            )}
            {(data.overhaulAt != null || data.engineSMOH != null) && (
              <div className="hero-num">
                <div className="hn-k">smoh</div>
                <div className="hn-v">{smohOf(data, maintHrs).toFixed(1)}</div>
              </div>
            )}
          </div>

          {/* The record's own state — saved, and last changed — moved to the
              ADS-B row, which is already about the data rather than the
              aeroplane. It leaves room here for a fourth and fifth clock when a
              twin turns up. */}
          <span className="hero-divider tall" />
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
          </div>
        </div>

        {/* Live ADS-B (skipped in preview harness to avoid network polling) */}
        {!previewSave && (
          <LiveBanner
            reg={aircraft.reg}
            aircraftId={aircraft.id}
            data={data}
            save={save}
            sync={sync}
            lastUpdated={typeof data.lastUpdated === "string" ? data.lastUpdated : null}
          />
        )}

        {/* Tab bar. v1 hid the Insurance button outright for roles without
            financial access and refused to navigate there; the port showed it
            to everyone, including pilots and mechanics. */}
        <div className="tabs">
          {visibleTabs.map((t) => (
            <button
              key={t}
              className={`tab ${activeTab === t ? "active" : ""}`}
              onClick={() => openTab(t)}
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
