"use client";

import { useState } from "react";
import { CORE_INSP, CORE_INSP_TURBINE, METER_LABEL, type Insp } from "@/lib/aircraft";
import type { TabProps } from "../detail-client";
import { InspTable } from "../insp-table";
import { LifeLimitedTab } from "./life-limited";

/**
 * The Inspections tab: the class's regulatory set (piston or turbine — a
 * Vision Jet has no 50-hour or 100-hour, and runs a phase programme instead)
 * in the shared inspections table.
 */
export function InspectionsTab(props: TabProps) {
  const { data, maintHrs, aircraft, save, consumeAction, allow, focusInsp, clearFocusInsp } = props;
  const all = (data.inspections ?? []) as Insp[];
  const CORE =
    data.acClass === "jet" || data.acClass === "turboprop" ? CORE_INSP_TURBINE : CORE_INSP;
  // Life Limited Parts lives here as a sub-tab rather than beside the main
  // tabs: it is inspections by another clock, not a separate subject.
  const [sub, setSub] = useState<"inspections" | "parts">("inspections");

  const switcher = (
    <div className="sub-tabs" role="tablist" aria-label="Inspections sections">
      {([["inspections", "Inspections"], ["parts", "Life Limited Parts"]] as const).map(([k, l]) => (
        <button key={k} role="tab" aria-selected={sub === k} className={`sub-tab${sub === k ? " on" : ""}`} onClick={() => setSub(k)}>
          {l}
        </button>
      ))}
    </div>
  );

  if (sub === "parts") {
    return (
      <>
        {switcher}
        <LifeLimitedTab {...props} />
      </>
    );
  }

  return (
    <>
      {switcher}
      {/* An hour-based inspection pinned to a meter reading zero can never be
          computed — it just shows NO HOURS forever with nothing saying why. */}
      {!(maintHrs > 0) && all.some((i) => i.intervalHrs && !i.inactive) && (
        <div className="grant-msg warn" style={{ marginBottom: 10 }}>
          Hour-based inspections can&rsquo;t be tracked: this aircraft&rsquo;s
          maintenance clock is <b>{METER_LABEL[aircraft.maint_basis]}</b>, which
          reads 0.0. Set the current hours — or point the maintenance clock at
          the meter you actually track — in Aircraft Settings.
        </div>
      )}
      <InspTable
        items={all}
        presets={CORE}
        save={(next) => save({ ...data, inspections: next })}
        maintHrs={maintHrs}
        canEdit={allow("inspection")}
        focus={focusInsp}
        clearFocus={clearFocusInsp}
        openAddOnMount={consumeAction("log-inspection")}
      />
    </>
  );
}
