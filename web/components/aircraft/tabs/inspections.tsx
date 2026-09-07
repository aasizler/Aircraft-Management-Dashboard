"use client";

import { useState } from "react";
import { CORE_INSP, CORE_INSP_TURBINE, makeLifeLimitedParts, METER_LABEL, intervalShort, type Insp } from "@/lib/aircraft";
import { applyProgram, engineTbo, enginesFor, programsFor, PROGRAMS } from "@/lib/programs";
import type { TabProps } from "../detail-client";
import { InspTable } from "../insp-table";
import { LifeLimitedTab } from "./life-limited";
import { Modal } from "@/components/ui/modal";
import { useToast } from "@/components/ui/toast";

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

  // Maintenance programme: chosen once, applied to both tables, every
  // interval editable afterwards.
  const toast = useToast();
  const cls = data.acClass ?? "piston";
  const typeName = aircraft.type ?? (data.type as string | null);
  const current = PROGRAMS.find((p) => p.id === data.maintProgram);
  const [progOpen, setProgOpen] = useState(false);
  const [progId, setProgId] = useState<string>(current?.id ?? programsFor(cls, typeName)[0]?.id ?? "part91-piston");
  const [engines, setEngines] = useState<1 | 2>((data.engines as 1 | 2 | undefined) ?? enginesFor(typeName) ?? 1);
  const [applying, setApplying] = useState(false);
  const choices = programsFor(cls, typeName);
  const chosen = PROGRAMS.find((p) => p.id === progId) ?? choices[0];

  async function applyChosen() {
    if (!chosen) return;
    setApplying(true);
    try {
      const parts = (data.lifeLimitedParts as Insp[] | undefined) ?? makeLifeLimitedParts(cls, typeName);
      const next = applyProgram(chosen, engines, { inspections: all, parts }, engineTbo(data.engineType as string | null));
      await save({ ...data, inspections: next.inspections, lifeLimitedParts: next.parts, maintProgram: chosen.id, engines });
      setProgOpen(false);
      toast(`${chosen.name} applied`, "ok");
    } finally {
      setApplying(false);
    }
  }

  const programButton = allow("inspection") ? (
    <button className="btn sm" onClick={() => setProgOpen(true)} title="Maintenance programme">
      {current ? current.name : "Program"}
    </button>
  ) : null;

  const programModal = progOpen && (
    <Modal title="Maintenance program" onClose={() => setProgOpen(false)}>
      <p className="modal-sub">
        A program adds its checks and part lives with default intervals. Rows you already have keep their records;
        every interval can be edited afterwards. The manual for this serial number is the authority.
      </p>
      <div className="radio-list">
        {choices.map((p) => (
          <label key={p.id} className="radio-row prog-row">
            <span>
              <span className="prog-name">{p.name}</span>
              <span className="prog-note">{p.note}</span>
              <span className="prog-rows mono">
                {p.checks.map((i) => `${i.name} · ${intervalShort(i)}`).join("   ") || "Certificate items only"}
              </span>
            </span>
            <input type="radio" name="prog" checked={progId === p.id} onChange={() => setProgId(p.id)} />
          </label>
        ))}
      </div>
      {cls !== "piston" || engines === 2 || enginesFor(typeName) === 2 ? (
        <div className="form-row" style={{ marginTop: 12 }}>
          <label>Engines</label>
          <div className="sub-tabs">
            {([1, 2] as const).map((n) => (
              <button key={n} type="button" className={`sub-tab${engines === n ? " on" : ""}`} onClick={() => setEngines(n)}>
                {n === 1 ? "Single" : "Twin — left and right rows"}
              </button>
            ))}
          </div>
        </div>
      ) : null}
      <div className="form-actions">
        <button className="btn-cancel" onClick={() => setProgOpen(false)}>Cancel</button>
        <button className="btn-save" onClick={applyChosen} disabled={applying || !chosen}>{applying ? "Applying…" : "Apply program"}</button>
      </div>
    </Modal>
  );

  const switcher = (
    <div className="sub-tabs" role="tablist" aria-label="Inspections sections">
      {([["inspections", "Inspections"], ["parts", "Life Limited Parts"]] as const).map(([k, l]) => (
        <button key={k} role="tab" aria-selected={sub === k} className={`sub-tab${sub === k ? " on" : ""}`} onClick={() => setSub(k)}>
          {l}
        </button>
      ))}
    </div>
  );

  if (sub === "parts") return <>{programModal}<LifeLimitedTab {...props} center={switcher} tools={programButton} /></>;

  return (
    <>
      {programModal}
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
        center={switcher}
        tools={programButton}
      />
    </>
  );
}
