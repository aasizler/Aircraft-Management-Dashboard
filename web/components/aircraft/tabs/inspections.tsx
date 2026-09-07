"use client";

import { CORE_INSP, CORE_INSP_TURBINE, METER_LABEL, type Insp } from "@/lib/aircraft";
import type { TabProps } from "../detail-client";
import { InspTable } from "../insp-table";

/**
 * The Inspections tab: the class's regulatory set (piston or turbine — a
 * Vision Jet has no 50-hour or 100-hour, and runs a phase programme instead)
 * in the shared inspections table.
 */
export function InspectionsTab({
  data, maintHrs, aircraft, save, consumeAction, allow, focusInsp, clearFocusInsp,
}: TabProps) {
  const all = (data.inspections ?? []) as Insp[];
  const CORE =
    data.acClass === "jet" || data.acClass === "turboprop" ? CORE_INSP_TURBINE : CORE_INSP;

  return (
    <>
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
      <div className="insp-meter mono">
        measured against {METER_LABEL[aircraft.maint_basis].toLowerCase()} · {maintHrs.toFixed(1)} hrs
      </div>
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
