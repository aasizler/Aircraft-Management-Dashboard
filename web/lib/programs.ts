import { AIRCRAFT_DB, ENGINE_DB, type AcClass } from "./reference-data";
import { CORE_INSP, CORE_INSP_TURBINE, type Insp, type OpsRules } from "./aircraft";

/**
 * Maintenance programmes: a named schedule with its rows and default
 * intervals, chosen once per aircraft and applied to both inspection tables.
 * Every interval is a default from the manufacturer's published schedule as
 * commonly operated, and every one is editable afterwards — the manual for
 * the serial number in the hangar is the authority, not this file.
 *
 * Per-engine rows are templates: "{E} Hot Section Inspection" becomes one
 * row on a single and "Left …" / "Right …" on a twin.
 */
export type Program = {
  id: string;
  name: string;
  /** One line on where the defaults come from and what to verify. */
  note: string;
  cls: AcClass[];
  /** Type names or ICAO designators this is written for; unset = any of the class. */
  match?: RegExp;
  /** The programme's own checks, on top of the class's certificate items. */
  checks: Insp[];
  parts: Insp[];
};

const Y = (n: number) => n * 365;
const M = (n: number) => n * 30;
const row = (name: string, intervalHrs: number | null, intervalDays: number | null, extra: Partial<Insp> = {}): Insp =>
  ({ name, intervalHrs, intervalDays, core: true, lastDate: null, lastHobbs: null, by: null, updatedOn: null, populated: false, ...extra });

const REG = (turbine: boolean) => (turbine ? CORE_INSP_TURBINE : CORE_INSP)
  .filter((i) => i.name !== "Scheduled / Phase Inspection")
  .map((i) => row(i.name, i.intervalHrs ?? null, i.intervalDays ?? null, { intervalLabel: i.intervalLabel }));

// Template names match the seed's generic rows exactly on a single ("{E} "
// drops away), so applying a programme replaces the placeholder rather than
// sitting beside it; on a twin they become Left/Right.
const PT6_PARTS: Insp[] = [
  row("{E} Engine Hot Section Inspection", 1800, null, { group: "general" }),
  row("{E} Engine Overhaul", 3600, null, { group: "general" }),
  row("{E} Propeller Overhaul", 3000, M(72), { group: "general" }),
];
const JET_PARTS: Insp[] = [
  row("{E} Engine Hot Section Inspection", null, null, { group: "general", intervalLabel: "Per engine program" }),
  row("{E} Engine Overhaul", null, null, { group: "general", intervalLabel: "Per engine program" }),
];

export const PROGRAMS: Program[] = [
  {
    id: "part91-piston",
    name: "Annual and 100-hour",
    note: "The 91.409 schedule: annual and 100-hour with the 50-hour oil change, plus the certificate items. What most piston aircraft run.",
    cls: ["piston"],
    checks: [],
    parts: [row("{E} Engine (TBO)", 2000, Y(12), { group: "general" }), row("{E} Propeller", 2400, Y(6), { group: "general" })],
  },
  {
    id: "part91-turbine",
    name: "Manufacturer's program",
    note: "The certificate items, with the engine and propeller lives. Add the airframe checks from the manufacturer's schedule or the program your provider manages.",
    cls: ["turboprop"],
    checks: [],
    parts: PT6_PARTS,
  },
  {
    id: "part91-jet",
    name: "Manufacturer's program",
    note: "The certificate items, with the engine lives. Add the airframe checks from the manufacturer's schedule or the program your provider manages.",
    cls: ["jet"],
    checks: [],
    parts: JET_PARTS,
  },
  {
    id: "kingair-phase",
    name: "King Air phase inspections",
    note: "Beechcraft's Phase 1–4, each at 200 hours, all four within 800 hours or 24 months. PT6A hot section and overhaul lives are typical values; verify against the engine's service bulletin.",
    cls: ["turboprop"],
    match: /king air|BE9|B350|B300|BE20|BE30/i,
    checks: [
      row("Phase 1 Inspection", 200, M(24)),
      row("Phase 2 Inspection", 200, M(24)),
      row("Phase 3 Inspection", 200, M(24)),
      row("Phase 4 Inspection", 200, M(24)),
    ],
    parts: PT6_PARTS,
  },
  {
    id: "tbm-checks",
    name: "TBM A / B / C checks",
    note: "Daher's A check at 100 hours, B at 200, C at 600, alongside the annual. Verify the calendar limits against the current TBM maintenance manual.",
    cls: ["turboprop"],
    match: /TBM/i,
    checks: [row("A Check", 100, null), row("B Check", 200, null), row("C Check", 600, null)],
    parts: PT6_PARTS,
  },
  {
    id: "pc12-checks",
    name: "PC-12 checks",
    note: "Pilatus's 100-hour / annual check and the 300-hour check. Longer-interval items vary by serial and service bulletin status; add them from the manual.",
    cls: ["turboprop"],
    match: /PC-?12|Pilatus/i,
    checks: [row("100 Hour / Annual Check", 100, Y(1)), row("300 Hour Check", 300, null)],
    parts: PT6_PARTS,
  },
  {
    id: "citation-phase",
    name: "Citation phase inspections",
    note: "Cessna's Phase 1–4 on a 12-month calendar and Phase 5 at 36 months; hour limits differ by model, so set them from the manual.",
    cls: ["jet"],
    match: /citation|C25|C510|C525|C55|C56X|C68|C700|C750|CJ/i,
    checks: [
      row("Phase 1 Inspection", null, M(12)),
      row("Phase 2 Inspection", null, M(12)),
      row("Phase 3 Inspection", null, M(12)),
      row("Phase 4 Inspection", null, M(12)),
      row("Phase 5 Inspection", null, M(36)),
    ],
    parts: JET_PARTS,
  },
];

export const RULES: { id: OpsRules; name: string; hint: string }[] = [
  { id: "91", name: "Part 91", hint: "Private operation. Manufacturer overhaul lives are advisory." },
  { id: "135", name: "Part 135", hint: "Charter, nine seats or fewer. The 100-hour, emergency-equipment checks and manufacturer lives are required (135.411, 135.421). An approved inspection program (135.419) replaces the annual/100-hour: pick the type's program and edit it to the approved one." },
  { id: "121", name: "Part 121", hint: "Scheduled air carrier. Continuous airworthiness program per your Ops Specs; every check here is required." },
  { id: "125", name: "Part 125", hint: "Large aircraft, 20+ seats or 6,000 lb payload, non-common carriage. Continuous airworthiness program; every check here is required." },
];

const REQ_135 = "14 CFR 135.411(a)(1)";
const REQ_135_LIVES = "14 CFR 135.421";
const REQ_135_PROGRAM = "14 CFR 135.419";
const REQ_CAMP: Record<string, string> = { "121": "14 CFR 121.367", "125": "14 CFR 125.245" };

const isLife = (name: string) => /Engine|Propeller|Hot Section|Overhaul|CAPS|Reefing|Inflator|Rocket|Parachute/i.test(name);
const isCheck = (name: string) => /Phase|Check|Hour/i.test(name) && !/ELT|VOR|Transponder|Pitot/i.test(name);

/**
 * Apply the operating rules: under Part 135 the 100-hour, emergency-equipment
 * checks and manufacturer lives are flagged as what the rules require; under
 * 121 and 125 everything on a continuous airworthiness program is. Under
 * Part 91 the flags come off. The flag only decides what counts toward
 * airworthiness; it never activates or locks a row — the operator knows
 * what their rules demand, and a deactivated row stays deactivated. Rows are
 * added only when missing, and records are never touched.
 */
export function applyRules(
  rules: OpsRules,
  engines: 1 | 2,
  cls: AcClass,
  current: { inspections: Insp[]; parts: Insp[] },
): { inspections: Insp[]; parts: Insp[] } {
  const clear = (i: Insp): Insp => ({ ...i, required: null });
  // Engine and propeller rows must match the engine count: a single sheds
  // unrecorded Left/Right rows, a twin sheds unrecorded single ones, so a
  // change of count — or an earlier guess — never leaves both shapes behind.
  const blank = (i: Insp) => !i.populated && !i.lastDate && i.lastHobbs == null;
  const shaped = (parts: Insp[]) => parts.filter((i) => {
    if (!isLife(i.name) || !blank(i)) return true;
    const sided = /^(Engine|Propeller) [12]\b|^(Left|Right) /.test(i.name) && !/^(Left|Right) /.test(i.name);
    if (/^(Left|Right) /.test(i.name)) return false; // the old naming; re-added as Engine 1 / 2
    return engines === 2 ? sided || !/Engine|Propeller|Hot Section|Overhaul/.test(i.name) : !sided;
  });
  current = { inspections: current.inspections, parts: shaped(current.parts) };
  if (rules === "91") return { inspections: current.inspections.map(clear), parts: current.parts.map(clear) };

  if (rules === "135") {
    // An approved inspection programme (135.419) stands in for the annual and
    // 100-hour, so where the aircraft carries programme checks those two are
    // not locked as required.
    const onProgram = current.inspections.some((i) => isCheck(i.name) && !/^(50|100)-Hour$/.test(i.name));
    const need: Insp[] = [
      row("Fire Extinguisher Inspection", null, M(12), { required: REQ_135 }),
      row("First Aid Kit Inspection", null, M(12), { required: REQ_135 }),
      ...(engines === 2 ? [row("Weight & Balance", null, M(36), { required: "14 CFR 135.185" })] : []),
      ...(cls === "piston" && !onProgram && !current.inspections.some((i) => i.name === "100-Hour")
        ? [row("100-Hour", 100, null, { required: REQ_135 })] : []),
    ];
    const have = new Set(current.inspections.map((i) => i.name));
    // A single does not carry the twin's weight-and-balance row.
    const base = engines === 2
      ? current.inspections
      : current.inspections.filter((i) => !(i.name === "Weight & Balance" && !i.populated && !i.lastDate && i.lastHobbs == null));
    const inspections = [
      ...base.map((i) => {
        if (i.name === "Annual Inspection" || i.name === "100-Hour")
          return onProgram ? { ...i, required: null } : { ...i, required: REQ_135 };
        // The 50-hour oil change is the engine maker's programme, which 135.421 makes mandatory.
        if (i.name === "50-Hour") return { ...i, required: REQ_135_LIVES };
        if (isCheck(i.name)) return { ...i, required: REQ_135_PROGRAM };
        if (/Fire Extinguisher|First Aid|Weight & Balance/.test(i.name)) return { ...i, required: REQ_135 };
        return { ...i, required: null };
      }),
      ...need.filter((i) => !have.has(i.name)),
    ];
    const parts = current.parts.map((i) => (isLife(i.name) ? { ...i, required: REQ_135_LIVES } : { ...i, required: null }));
    return { inspections, parts };
  }

  // 121 / 125: a continuous airworthiness program — everything tracked is required.
  const reg = REQ_CAMP[rules];
  return {
    inspections: current.inspections.map((i) => ({ ...i, required: reg })),
    parts: current.parts.map((i) => (isLife(i.name) ? { ...i, required: reg } : { ...i, required: null })),
  };
}

/** Programmes written for this aircraft first, then the class's standard. */
export function programsFor(cls: AcClass, typeName: string | null | undefined): Program[] {
  const t = typeName ?? "";
  const list = PROGRAMS.filter((p) => p.cls.includes(cls));
  return [...list.filter((p) => p.match?.test(t)), ...list.filter((p) => !p.match)];
}

/** 1 or 2, from the type catalogue's description or the name itself; null when unknown. */
export function enginesFor(typeName: string | null | undefined): 1 | 2 | null {
  const t = (typeName ?? "").toLowerCase();
  if (!t) return null;
  if (/twin|baron|seneca|seminole|king air|conquest|navajo|aztec|duchess|340|402|414|421|310/.test(t)) return 2;
  const hit = AIRCRAFT_DB.find((a) =>
    t.includes(a.icao.toLowerCase()) ||
    a.model.toLowerCase().split(/\s*\/\s*/).some((m) => m.length > 2 && t.includes(m)));
  if (!hit) return null;
  return /twin|× ?2|x ?2/i.test(hit.desc ?? "") ? 2 : 1;
}

/** The catalogue TBO for the aircraft's engine, when it is one we know. */
export function engineTbo(engineType: string | null | undefined): number | null {
  const e = (engineType ?? "").toLowerCase();
  if (!e) return null;
  return ENGINE_DB.find((x) => e.includes(x.id.toLowerCase()) || e.includes(x.model.toLowerCase()))?.tbo ?? null;
}

// Twins number their engines 1 and 2, as the logbooks do: "{E} Engine
// Overhaul" becomes "Engine 1 Overhaul" and "Engine 2 Overhaul"; "{E}
// Propeller Overhaul" becomes "Propeller 1 Overhaul". A single drops the
// placeholder.
const numbered = (name: string, n: number) =>
  name.replace(/^\{E\} (Engine|Propeller)/, `$1 ${n}`).replace("{E} ", "");
const expand = (tpl: Insp, engines: 1 | 2): Insp[] =>
  tpl.name.includes("{E}")
    ? engines === 2
      ? [{ ...tpl, name: numbered(tpl.name, 1) }, { ...tpl, name: numbered(tpl.name, 2) }]
      : [{ ...tpl, name: tpl.name.replace("{E} ", "") }]
    : [tpl];

/** Catalogue engines fitted to this type, for the picker. */
export function enginesForType(typeName: string | null | undefined) {
  const t = (typeName ?? "").toLowerCase();
  const words = t.split(/[^a-z0-9]+/).filter((w) => w.length > 2 && !/^(the|jet|cirrus|cessna|beechcraft|piper|socata|daher|pilatus)$/.test(w));
  return ENGINE_DB.filter((e) => {
    const app = e.app.toLowerCase();
    return words.some((w) => app.includes(w));
  });
}

/**
 * Merge a programme into what the aircraft already has: rows it lacks are
 * added, rows it has keep their records and intervals, and the generic
 * "Scheduled / Phase Inspection" placeholder goes once a real programme
 * supplies phases. Nothing recorded is lost.
 */
export function applyProgram(
  p: Program,
  engines: 1 | 2,
  current: { inspections: Insp[]; parts: Insp[] },
  tbo: number | null,
  rules: OpsRules = "91",
): { inspections: Insp[]; parts: Insp[] } {
  // A row the aircraft has keeps its record; a never-recorded row that the
  // programme also supplies takes the programme's interval, so a seed
  // placeholder with no interval becomes the real thing.
  const merge = (have: Insp[], add: Insp[]) => {
    const byName = new Map(add.map((i) => [i.name, i]));
    const kept = have.map((i) => {
      const a = byName.get(i.name);
      if (!a) return i;
      byName.delete(i.name);
      return i.populated || i.lastDate || i.lastHobbs != null
        ? i
        : { ...i, intervalHrs: a.intervalHrs, intervalDays: a.intervalDays, intervalLabel: a.intervalLabel, core: true };
    });
    return [...kept, ...byName.values()];
  };
  const inspAdd = [...REG(p.cls[0] !== "piston"), ...p.checks];
  const partsAdd = p.parts.flatMap((t) => expand(t, engines)).map((r) =>
    tbo && /Engine Overhaul|Engine \(TBO\)/.test(r.name) ? { ...r, intervalHrs: tbo } : r);
  const inspHave = p.checks.length
    ? current.inspections.filter((i) => !(i.name === "Scheduled / Phase Inspection" && !i.populated))
    : current.inspections;
  // On a twin, the programme's Left/Right rows supersede the seed's single
  // generic engine and propeller rows, when those were never recorded.
  const generic = new Set(["Engine Hot Section Inspection", "Engine Overhaul", "Propeller Overhaul", "Engine (TBO)", "Propeller"]);
  const partsHave = engines === 2
    ? current.parts.filter((i) => !(generic.has(i.name) && !i.populated && !i.lastDate && i.lastHobbs == null))
    : current.parts;
  return applyRules(rules, engines, p.cls[0], { inspections: merge(inspHave, inspAdd), parts: merge(partsHave, partsAdd) });
}
