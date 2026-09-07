"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { CORE_INSP, CORE_INSP_TURBINE, makeLifeLimitedParts, METER_LABEL, intervalShort, type Insp, type OpsRules } from "@/lib/aircraft";
import { applyProgram, applyRules, engineTbo, enginesFor, programsFor, PROGRAMS, RULES } from "@/lib/programs";
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
  const all = useMemo(() => (data.inspections ?? []) as Insp[], [data.inspections]);
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

  // Maintenance programme: the schedule the aircraft is on — the
  // manufacturer's, a phase programme, or one a provider manages. Chosen
  // once, applied to both tables, every interval editable afterwards.
  const toast = useToast();
  const cls = data.acClass ?? "piston";
  const typeName = aircraft.type ?? (data.type as string | null);
  const current = PROGRAMS.find((p) => p.id === data.maintProgram);
  const [progOpen, setProgOpen] = useState(false);
  const [progId, setProgId] = useState<string>(current?.id ?? programsFor(cls, typeName)[0]?.id ?? "part91-piston");
  const [applying, setApplying] = useState(false);
  const choices = programsFor(cls, typeName);
  const chosen = PROGRAMS.find((p) => p.id === progId) ?? choices[0];
  // Engine count comes from the type catalogue; nobody is asked.
  const engines: 1 | 2 = (data.engines as 1 | 2 | undefined) ?? enginesFor(typeName) ?? 1;

  // Operating rules are a separate fact from the programme: they decide what
  // on the schedule is mandatory. Their own small dialog.
  const rules = data.opsRules ?? "91";
  const [rulesOpen, setRulesOpen] = useState(false);
  const [rulesSel, setRulesSel] = useState<OpsRules>(rules);
  const rulesSelInfo = RULES.find((r) => r.id === rulesSel);

  // When the rules say Part 135 or above and the rows they require are not
  // all present and flagged, apply them once.
  const applied = useRef(false);
  useEffect(() => {
    if (applied.current || rules === "91" || !allow("inspection")) return;
    const parts = (data.lifeLimitedParts as Insp[] | undefined) ?? makeLifeLimitedParts(cls, typeName);
    const next = applyRules(rules, engines, cls, { inspections: all, parts });
    const changed = JSON.stringify(next) !== JSON.stringify({ inspections: all, parts });
    if (!changed) return;
    applied.current = true;
    void save({ ...data, inspections: next.inspections, lifeLimitedParts: next.parts });
  }, [rules, engines, cls, typeName, all, data, save, allow]);

  async function applyChosen() {
    if (!chosen) return;
    setApplying(true);
    try {
      const parts = (data.lifeLimitedParts as Insp[] | undefined) ?? makeLifeLimitedParts(cls, typeName);
      const next = applyProgram(chosen, engines, { inspections: all, parts }, engineTbo(data.engineType as string | null), rules);
      await save({ ...data, inspections: next.inspections, lifeLimitedParts: next.parts, maintProgram: chosen.id, engines });
      setProgOpen(false);
      toast(`${chosen.name} applied`, "ok");
    } finally {
      setApplying(false);
    }
  }

  async function applyRulesSel() {
    setApplying(true);
    try {
      const parts = (data.lifeLimitedParts as Insp[] | undefined) ?? makeLifeLimitedParts(cls, typeName);
      const next = applyRules(rulesSel, engines, cls, { inspections: all, parts });
      await save({ ...data, inspections: next.inspections, lifeLimitedParts: next.parts, opsRules: rulesSel, engines });
      setRulesOpen(false);
      toast(`Operating rules set to Part ${rulesSel}`, "ok");
    } finally {
      setApplying(false);
    }
  }

  const programButton = allow("inspection") ? (
    <>
      <button className="btn sm" onClick={() => { setRulesSel(rules); setRulesOpen(true); }} title="Operating rules">
        Part {rules}
      </button>
      <button className="btn sm" onClick={() => setProgOpen(true)} title="Maintenance program">
        {current ? current.name : "Program"}
      </button>
    </>
  ) : null;

  const programModal = (
    <>
      {progOpen && (
        <Modal title="Maintenance program" onClose={() => setProgOpen(false)}>
          <p className="modal-sub">
            The schedule this aircraft is maintained to. Applying one adds its checks and part lives with default intervals;
            rows you already have keep their records, and every interval can be edited afterwards. The manual for this
            serial number, or the program your provider manages, is the authority.
          </p>
          <div className="radio-list">
            {choices.map((p) => (
              <label key={p.id} className="radio-row prog-row">
                <span>
                  <span className="prog-name">{p.name}</span>
                  <span className="prog-note">{p.note}</span>
                  <span className="prog-rows mono">
                    {p.checks.map((i) => `${i.name} · ${intervalShort(i)}`).join("   ") || "Certificate items and engine lives"}
                  </span>
                </span>
                <input type="radio" name="prog" checked={progId === p.id} onChange={() => setProgId(p.id)} />
              </label>
            ))}
          </div>
          <div className="field-hint" style={{ marginTop: 10 }}>
            {engines === 2 ? "Twin: engine and propeller lives are tracked left and right." : "Single engine."}
          </div>
          <div className="form-actions">
            <button className="btn-cancel" onClick={() => setProgOpen(false)}>Cancel</button>
            <button className="btn-save" onClick={applyChosen} disabled={applying || !chosen}>{applying ? "Applying…" : "Apply program"}</button>
          </div>
        </Modal>
      )}
      {rulesOpen && (
        <Modal title="Operating rules" onClose={() => setRulesOpen(false)}>
          <p className="modal-sub">The rules this aircraft is operated under decide what on its schedule is mandatory.</p>
          <div className="radio-list">
            {RULES.map((r) => (
              <label key={r.id} className="radio-row prog-row">
                <span>
                  <span className="prog-name">{r.name}</span>
                  <span className="prog-note">{r.hint}</span>
                </span>
                <input type="radio" name="rules" checked={rulesSel === r.id} onChange={() => setRulesSel(r.id)} />
              </label>
            ))}
          </div>
          <div className="form-actions">
            <button className="btn-cancel" onClick={() => setRulesOpen(false)}>Cancel</button>
            <button className="btn-save" onClick={applyRulesSel} disabled={applying || !rulesSelInfo}>{applying ? "Applying…" : "Apply"}</button>
          </div>
        </Modal>
      )}
    </>
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
