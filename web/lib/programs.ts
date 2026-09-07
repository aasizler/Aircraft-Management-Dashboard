import { AIRCRAFT_DB, ENGINE_DB, type AcClass } from "./reference-data";
import { CORE_INSP, CORE_INSP_TURBINE, type Insp } from "./aircraft";

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
    name: "Part 91 standard",
    note: "FAR 91.409 annual and 100-hour, with the 50-hour oil change and the certificate items. The default for any piston aircraft.",
    cls: ["piston"],
    checks: [],
    parts: [row("{E} Engine (TBO)", 2000, Y(12), { group: "general" }), row("{E} Propeller", 2400, Y(6), { group: "general" })],
  },
  {
    id: "part91-turbine",
    name: "Part 91 standard (turbine)",
    note: "The certificate items only. Use this when the aircraft runs a programme not listed here, and add its checks by hand.",
    cls: ["turboprop"],
    checks: [],
    parts: PT6_PARTS,
  },
  {
    id: "part91-jet",
    name: "Part 91 standard (jet)",
    note: "The certificate items only. Use this when the aircraft runs a programme not listed here, and add its checks by hand.",
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

/** Programmes written for this aircraft first, then the class's standard. */
export function programsFor(cls: AcClass, typeName: string | null | undefined): Program[] {
  const t = typeName ?? "";
  const list = PROGRAMS.filter((p) => p.cls.includes(cls));
  return [...list.filter((p) => p.match?.test(t)), ...list.filter((p) => !p.match)];
}

/** 1 or 2, from the type catalogue's description; null when the type is unknown. */
export function enginesFor(typeName: string | null | undefined): 1 | 2 | null {
  const t = (typeName ?? "").toLowerCase();
  if (!t) return null;
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

const expand = (tpl: Insp, engines: 1 | 2): Insp[] =>
  tpl.name.includes("{E}")
    ? engines === 2
      ? [{ ...tpl, name: tpl.name.replace("{E}", "Left") }, { ...tpl, name: tpl.name.replace("{E}", "Right") }]
      : [{ ...tpl, name: tpl.name.replace("{E} ", "") }]
    : [tpl];

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
  return { inspections: merge(inspHave, inspAdd), parts: merge(partsHave, partsAdd) };
}
