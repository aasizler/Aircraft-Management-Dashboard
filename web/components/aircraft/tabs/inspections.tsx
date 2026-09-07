"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
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
  // The catalogue wins over a stored count: an earlier dialog could have
  // stored a guess, and the type does not change.
  const engines: 1 | 2 = enginesFor(typeName) ?? (data.engines as 1 | 2 | undefined) ?? 1;

  // Operating rules are a separate fact from the programme: they decide what
  // on the schedule is mandatory. Their own small dialog.
  const rules = data.opsRules ?? "91";
  const [rulesSel, setRulesSel] = useState<OpsRules>(rules);

  // When the rules say Part 135 or above and the rows they require are not
  // all present and flagged, apply them once.
  // Stored parts plus any seed row the aircraft lacks — a list saved before a
  // seed row existed is not left without it.
  const withSeed = useCallback((stored: Insp[] | undefined): Insp[] => {
    const seed = makeLifeLimitedParts(cls, typeName);
    if (!stored) return seed;
    const have = new Set(stored.map((i) => i.name));
    return [...stored, ...seed.filter((i) => !have.has(i.name))];
  }, [cls, typeName]);

  const applied = useRef(false);
  useEffect(() => {
    if (applied.current || rules === "91" || !allow("inspection")) return;
    const parts = withSeed(data.lifeLimitedParts as Insp[] | undefined);
    const next = applyRules(rules, engines, cls, { inspections: all, parts });
    const changed = JSON.stringify(next) !== JSON.stringify({ inspections: all, parts: data.lifeLimitedParts ?? parts });
    if (!changed) return;
    applied.current = true;
    void save({ ...data, inspections: next.inspections, lifeLimitedParts: next.parts });
  }, [rules, engines, cls, all, data, save, allow, withSeed]);

  async function applyOperations() {
    if (!chosen) return;
    setApplying(true);
    try {
      const parts = withSeed(data.lifeLimitedParts as Insp[] | undefined);
      const next = applyProgram(chosen, engines, { inspections: all, parts }, engineTbo(data.engineType as string | null), rulesSel);
      await save({ ...data, inspections: next.inspections, lifeLimitedParts: next.parts, maintProgram: chosen.id, engines, opsRules: rulesSel });
      setProgOpen(false);
      toast("Operations updated", "ok");
    } finally {
      setApplying(false);
    }
  }

  const programButton = allow("inspection") ? (
    <button className="btn sm" onClick={() => { setRulesSel(rules); setProgOpen(true); }} title="Operating rules and maintenance program">
      Part {rules} · {current ? current.name : "Program"}
    </button>
  ) : null;

  const programModal = progOpen && (
    <Modal title="Operations" onClose={() => setProgOpen(false)}>
      <div className="mono modal-kicker">Operated under</div>
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
      <div className="mono modal-kicker" style={{ marginTop: 16 }}>Maintenance program</div>
      {choices.length > 1 ? (
        <div className="radio-list">
          {choices.map((p) => (
            <label key={p.id} className="radio-row prog-row">
              <span>
                <span className="prog-name">{p.name}</span>
                {p.checks.length > 0 && (
                  <span className="prog-rows mono">
                    {p.checks.map((i) => `${i.name} · ${intervalShort(i)}`).join("   ")}
                  </span>
                )}
              </span>
              <input type="radio" name="prog" checked={progId === p.id} onChange={() => setProgId(p.id)} />
            </label>
          ))}
        </div>
      ) : (
        <div className="field-hint">{chosen?.name}. No named program on file for this type; add its checks with Log Inspection.</div>
      )}
      <div className="form-actions">
        <button className="btn-cancel" onClick={() => setProgOpen(false)}>Cancel</button>
        <button className="btn-save" onClick={applyOperations} disabled={applying || !chosen}>{applying ? "Applying…" : "Apply"}</button>
      </div>
    </Modal>
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
