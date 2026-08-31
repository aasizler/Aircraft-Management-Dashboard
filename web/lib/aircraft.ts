import type { MeterKind } from "./types";

// The v1 aircraft object, carried inside aircraft.data. Loosely typed — it is
// the same shape the HTML app used, ported as-is. Every field the legacy app
// wrote is declared here so nothing in the imported blob is silently dropped.
export type V1Aircraft = Record<string, unknown> & {
  inspections?: Insp[];
  oil?: OilEntry[];
  flights?: FlightEntry[];
  flightRoutes?: RouteEntry[];
  squawks?: Squawk[];
  squawkArchive?: ArchivedSquawk[];
  maintCosts?: MaintCost[];
  schedule?: SchedEvent[];
  documents?: DocEntry[];
  /**
   * @deprecated Lives in aircraft_financials now, not here. Kept on the type
   * only so a blob written by v1 still parses; nothing in the app reads it.
   * RLS gates rows and not jsonb keys, so anything left here is readable by
   * every role that can read the aircraft.
   */
  insurance?: Insurance;
  monthlyHours?: number[];
  oilByMonth?: number[];
  airportData?: Record<string, number> | null;
  engineSMOH?: number;
  engineType?: string | null;
  tbo?: number;
  tt?: number;
  oilInterval?: number;
  oilHobbs?: number;
  oilChangeDate?: string;
  lastUpdated?: string;
};

export type Insp = {
  name: string;
  core?: boolean;
  lastDate?: string | null;
  lastHobbs?: number | null;
  intervalHrs?: number | null;
  intervalDays?: number | null;
  intervalLabel?: string;
  by?: string | null;
  updatedOn?: string | null;
  populated?: boolean;
  inactive?: boolean;
};

export type OilEntry = {
  date: string;
  qty?: number;
  type?: string;
  hobbs?: number;
  notes?: string;
  kind?: "add" | "change";
};

export type FlightEntry = {
  date: string;
  from?: string;
  to?: string;
  hobbsOut?: number;
  hobbsIn?: number;
  dur?: number;
  notes?: string;
};

// What the ForeFlight CSV import and manual flight logging write. This — not
// `flights` — is what the legacy map plots.
export type RouteEntry = {
  from?: string;
  to?: string;
  date?: string;
  reg?: string;
  _fromCSV?: boolean;
};

export type SquawkStatus = "open" | "progress" | "watch";

export type Squawk = {
  id: string;
  desc: string;
  status: SquawkStatus;
  date: string;
};

export type ArchivedSquawk = Squawk & {
  archivedOn?: string;
  resolvedBy?: string | null;
  resolvedDate?: string | null;
  resolutionNotes?: string | null;
  attachment?: { name: string; size?: number; storagePath?: string } | null;
};

export type MaintCategory =
  | "inspection" | "engine" | "avionics" | "airframe"
  | "fuel" | "oil" | "parts" | "other";

export type MaintCost = {
  date: string;
  cost: number;
  cat: MaintCategory;
  desc?: string;
  shop?: string;
  receipt?: { name?: string; storagePath?: string } | null;
};

export type SchedEvent = {
  id?: string;
  type?: string;
  title?: string;
  start?: string;
  end?: string;
  pilot?: string;
  notes?: string;
  status?: string;
};

export type DocEntry = {
  name: string;
  size?: number;
  uploadedOn?: string;
  storagePath: string;
};

// v1 key names — `provider`/`expiration`/`hull`/`liability`/`deductible`.
// The first port read `carrier`/`expires`/`coverage`/`premium`, which silently
// hid every imported policy; readInsurance() below accepts both.
export type Insurance = {
  provider?: string;
  policy?: string;
  effective?: string;
  expiration?: string;
  hull?: number | string;
  liability?: string;
  deductible?: string;
  deductFlight?: string;
  deductGround?: string;
  pilotReq?: string;
  /** v1's key for coverage notes. */
  notes?: string;
  /** Written by an earlier build of the port; read as a fallback. */
  coverageNotes?: string;
  pilots?: Pilot[];
  documents?: DocEntry[];
};

export type Pilot = {
  name?: string;
  cert?: string;
  tt?: string | number;
  intype?: string | number;
  ratings?: string;
  medical?: string;
};

export type AircraftRow = {
  id: string;
  org_id: string;
  reg: string;
  type: string | null;
  airport: string | null;
  serial: string | null;
  maint_basis: MeterKind;
  cost_basis: MeterKind;
  /** Section of the hangar it files under. Null = ungrouped. */
  fleet_id?: string | null;
  data: V1Aircraft;
};

export type Meter = { kind: MeterKind; current: number; label: string | null };

export const meterValue = (meters: Meter[], kind: MeterKind) =>
  meters.find((m) => m.kind === kind)?.current ?? 0;

// ── Constants ported from the HTML ──────────────────────────────────────────

export const CORE_INSP: Insp[] = [
  { name: "Annual Inspection",        intervalDays: 365,  intervalHrs: null, intervalLabel: "12 months", core: true },
  { name: "50-Hour",                  intervalDays: null, intervalHrs: 50,   intervalLabel: "50 hrs",    core: true },
  { name: "100-Hour",                 intervalDays: null, intervalHrs: 100,  intervalLabel: "100 hrs",   core: true },
  { name: "ELT Battery / Check",      intervalDays: 365,  intervalHrs: null, intervalLabel: "12 months", core: true },
  { name: "Transponder Cert.",        intervalDays: 730,  intervalHrs: null, intervalLabel: "24 months", core: true },
  { name: "Pitot-Static / IFR Cert.", intervalDays: 730,  intervalHrs: null, intervalLabel: "24 months", core: true },
  { name: "VOR Check",                intervalDays: 30,   intervalHrs: null, intervalLabel: "30 days",   core: true },
];

// Seeds a new aircraft with the regulatory inspection set, exactly as v1's
// makeCoreInspections() did. Without this a new aircraft has no inspections.
export const makeCoreInspections = (): Insp[] =>
  CORE_INSP.map((c) => ({
    ...c,
    lastDate: null,
    lastHobbs: null,
    by: null,
    updatedOn: null,
    populated: false,
  }));

export const SQ_LABELS: Record<SquawkStatus, string> = {
  open: "Grounding",
  progress: "In Progress",
  watch: "Watch Item",
};
export const SQ_BADGE: Record<SquawkStatus, string> = {
  open: "overdue",
  progress: "ok",
  watch: "warn",
};
export const SQ_COLORS: Record<SquawkStatus, string> = {
  open: "var(--danger)",
  progress: "var(--ok)",
  watch: "var(--warn)",
};

/** Short labels — used on the cost-table badges, as v1 did. */
export const MAINT_CAT_LABELS: Record<MaintCategory, string> = {
  inspection: "Inspection", engine: "Engine", avionics: "Avionics",
  airframe: "Airframe", fuel: "Fuel", oil: "Oil/Fluids",
  parts: "Parts", other: "Other",
};

/** Long labels — used in the Log Cost dropdown, matching v1's option text. */
export const MAINT_CAT_OPTIONS: Record<MaintCategory, string> = {
  inspection: "Inspection / Annual", engine: "Engine Work", avionics: "Avionics",
  airframe: "Airframe", fuel: "Fuel", oil: "Oil / Fluids",
  parts: "Parts", other: "Other",
};
export const MAINT_CAT_HEX: Record<MaintCategory, string> = {
  inspection: "#4a9eff", engine: "#f04b4b", avionics: "#a78bfa",
  airframe: "#f59e0b", fuel: "#34d399", oil: "#2dd4a0",
  parts: "#60a5fa", other: "#888888",
};

// ── Inspection status ───────────────────────────────────────────────────────

export type InspStatus = "none" | "unknown" | "ok" | "warn" | "overdue";

/**
 * Calendar-interval due date, ported verbatim from v1's calMonthDue():
 * the day-interval is converted to whole months (365→12, 730→24, 30→1), the
 * month is advanced, and the due date is the LAST DAY of that month at local
 * midnight. Adding raw days and snapping instead drifts by a day on the
 * countdown and can land a 730-day interval in the wrong month.
 */
function calMonthDue(lastDate: string, days: number): Date {
  const months = Math.round(days / 30.4375);
  const d = new Date(lastDate + "T12:00:00");
  const dueYear = d.getFullYear() + Math.floor((d.getMonth() + months) / 12);
  const dueMonth = (d.getMonth() + months) % 12;
  return new Date(dueYear, dueMonth + 1, 0); // last day of dueMonth, midnight
}

/**
 * Ported from ic() in aerotrack_v1_07_3_6.html, with two corrections:
 *
 *  - hours are measured against the aircraft's declared maintenance clock
 *    (maintHrs), NOT Math.max(hobbs,tt) — v1's bug for aircraft whose
 *    maintenance basis is the smaller meter;
 *  - an inspection that was never recorded returns "none" and one whose hour
 *    clock is unreadable returns "unknown", so neither renders as a green OK.
 *    v1 got this right in the table (a grey NOT SET chip); the first port did
 *    not, which made empty aircraft read as airworthy.
 */
export function ic(i: Insp, maintHrs: number) {
  const blank = { p: 0, nl: "—", remNum: "—" as string | number, remUnit: "", remFoot: "" };

  // Never recorded → not tracked. Never green.
  if (!i.lastDate && !i.populated && i.lastHobbs == null)
    return { ...blank, s: "none" as InspStatus };

  let p = 0,
    nl = "",
    remNum: string | number = "",
    remUnit = "",
    remFoot = "";
  let hoursBlocked = false;
  // "Overdue" is a claim about the DUE DATE, not about a progress bar reaching
  // 100%. The calendar bar fills the moment the due day starts, so deriving the
  // badge from the percentage marked an inspection OVERDUE on the day it was
  // still legal — the row read "due today" and "OVERDUE" at the same time.
  let pastDue = false;
  const t = Date.now();

  if (i.intervalHrs && i.lastHobbs != null) {
    // A zero/absent meter can't be compared against a recorded hour reading —
    // v1 printed "819 hrs rem" here, counting from 0 back up to lastHobbs.
    if (!(maintHrs > 0)) {
      hoursBlocked = true;
    } else {
      const u = maintHrs - (i.lastHobbs || 0);
      p = Math.min(100, (u / i.intervalHrs) * 100);
      const rem = Math.max(0, i.intervalHrs - u);
      pastDue = u >= i.intervalHrs;
      nl = `${(i.lastHobbs + i.intervalHrs).toFixed(0)} hrs (${rem.toFixed(0)} hrs rem)`;
      if (rem <= 0) {
        remNum = "Due Now";
      } else {
        const rh = Math.round(rem);
        remNum = rh;
        remUnit = rh === 1 ? "Hour" : "Hours";
        remFoot = "remaining";
      }
    }
  }

  if (i.intervalDays && i.lastDate) {
    const nx = calMonthDue(i.lastDate, i.intervalDays);
    const start = new Date(i.lastDate + "T12:00:00").getTime();
    const totalMs = nx.getTime() - start;
    const dp = totalMs > 0 ? Math.min(100, ((t - start) / totalMs) * 100) : 0;
    if (dp > p) {
      p = dp;
      // Whole CALENDAR days between today and the due day. Differencing raw
      // timestamps compared local-midnight-of-the-due-day against the current
      // clock time, so an inspection due today read "1d overdue" from about
      // 11:36am onward — Math.round tipped the -0.x to -1 partway through the
      // day. Flooring both ends to local midnight keeps the label stable.
      const midnight = new Date(t);
      midnight.setHours(0, 0, 0, 0);
      const dl = Math.round((nx.getTime() - midnight.getTime()) / 86_400_000);
      // Local date parts, not toISOString(): nx is local midnight, so UTC
      // formatting printed the previous day for anyone east of Greenwich.
      const dateStr = `${nx.getFullYear()}-${String(nx.getMonth() + 1).padStart(2, "0")}-${String(nx.getDate()).padStart(2, "0")}`;
      pastDue = dl < 0;
      if (dl < 0) {
        nl = `${dateStr} (${Math.abs(dl)}d overdue)`;
        remNum = Math.abs(dl);
        remUnit = Math.abs(dl) === 1 ? "Day" : "Days";
        remFoot = "overdue";
      } else if (dl === 0) {
        nl = `${dateStr} (due today)`;
        remNum = "Due Today";
      } else {
        nl = `${dateStr} (${dl}d)`;
        remNum = dl;
        remUnit = dl === 1 ? "Day" : "Days";
        remFoot = "remaining";
      }
    }
  }

  // Hour-based interval with no usable meter and nothing else to fall back on.
  if (hoursBlocked && !nl)
    return { ...blank, s: "unknown" as InspStatus, nl: "hours not set" };

  let s: InspStatus = "ok";
  if (pastDue) s = "overdue";
  else if (p >= 80) s = "warn";
  return { p, s, nl, remNum, remUnit, remFoot, hoursBlocked };
}

// Labels match v1's _inspRow() exactly — a healthy inspection reads "Current",
// not "OK". "NO HOURS" is the one addition: v1 had no way to express an
// hour-based interval with an unusable meter, and printed nonsense instead.
export const INSP_BADGE: Record<InspStatus, { cls: string; label: string }> = {
  none:    { cls: "",        label: "NOT SET" },
  unknown: { cls: "info",    label: "NO HOURS" },
  ok:      { cls: "ok",      label: "Current" },
  warn:    { cls: "warn",    label: "DUE SOON" },
  overdue: { cls: "overdue", label: "OVERDUE" },
};

/** The interval as v1 printed it: "12 months" / "24 months", not "365 days". */
export function intervalText(i: Insp): string {
  const core = CORE_INSP.find((c) => c.name === i.name);
  if (core?.intervalLabel) return core.intervalLabel;
  if (i.intervalLabel) return i.intervalLabel;
  if (i.intervalHrs) return `${i.intervalHrs} hrs`;
  if (i.intervalDays) return `${i.intervalDays} days`;
  return "—";
}

// Oil life, ported from oilLife(). Counts up from the last oil change against
// the declared maintenance clock. `tracked` is false when there is nothing to
// measure against, so the UI can show "—" instead of a confident 100%.
export function oilLife(a: V1Aircraft, maintHrs: number) {
  const interval = Number(a.oilInterval) || 50;
  const base = Number(a.oilHobbs ?? 0);
  // Two different reasons this can't be computed, and they need different
  // words: nothing was ever logged, versus something was logged but the
  // maintenance clock reads zero so there is nothing to measure from.
  const hasRecord = a.oilHobbs != null || (a.oil ?? []).length > 0;
  const meterReadable = maintHrs > 0;
  const tracked = meterReadable && hasRecord;
  const used = Math.max(0, maintHrs - base);
  const hrsLeft = interval - used;
  const pct = Math.max(0, Math.min(100, (hrsLeft / interval) * 100));
  return {
    pct, hrsLeft, used, interval, tracked, hasRecord, meterReadable,
    overdueHrs: hrsLeft < 0 ? -hrsLeft : 0,
  };
}

// ── Shape-tolerant readers for the imported v1 blob ─────────────────────────

/**
 * v1 stores monthlyHours / oilByMonth as a PLAIN NUMBER ARRAY indexed by month
 * (e.g. [0,0,0,0,0,23] = the last 6 months). The first port read it as an array
 * of {month, hours} objects, which silently zeroed every value — N137BF's 23
 * logged hours rendered as 0.0. Accept both shapes.
 */
export function readMonthly(
  raw: unknown,
  monthsBack = 6,
): { month: string; hours: number }[] {
  if (!Array.isArray(raw) || raw.length === 0) return [];
  const now = new Date();
  const labelFor = (idxFromEnd: number) => {
    const d = new Date(now.getFullYear(), now.getMonth() - idxFromEnd, 1);
    return d.toISOString().slice(0, 7);
  };
  const arr = raw.slice(-monthsBack);
  return arr.map((v, i) => {
    if (typeof v === "number")
      return { month: labelFor(arr.length - 1 - i), hours: v };
    const o = (v ?? {}) as Record<string, unknown>;
    return {
      month: String(o.month ?? o.m ?? o.label ?? labelFor(arr.length - 1 - i)),
      hours: Number(o.hours ?? o.h ?? o.value ?? 0) || 0,
    };
  });
}

/** Reads insurance under v1 keys, falling back to the port's earlier names. */
export function readInsurance(raw: unknown): Insurance {
  const o = (raw ?? {}) as Record<string, unknown>;
  const pick = (...keys: string[]) => {
    for (const k of keys) {
      const v = o[k];
      if (v != null && v !== "") return v;
    }
    return undefined;
  };
  return {
    provider: pick("provider", "carrier") as string | undefined,
    policy: pick("policy") as string | undefined,
    effective: pick("effective") as string | undefined,
    expiration: pick("expiration", "expires") as string | undefined,
    hull: pick("hull", "coverage") as number | string | undefined,
    liability: pick("liability") as string | undefined,
    deductible: pick("deductible") as string | undefined,
    deductFlight: pick("deductFlight") as string | undefined,
    deductGround: pick("deductGround") as string | undefined,
    pilotReq: pick("pilotReq", "openPilot") as string | undefined,
    coverageNotes: pick("coverageNotes", "notes") as string | undefined,
    pilots: (o.pilots as Pilot[]) ?? [],
    documents: (o.documents as DocEntry[]) ?? [],
  };
}

/**
 * Every route the aircraft has flown. Legacy keeps ForeFlight-imported and
 * manually logged legs in `flightRoutes` (79 entries on N137BF) and only
 * manual entries in `flights`; the map must read both or it renders empty.
 */
export function allRoutes(a: V1Aircraft): RouteEntry[] {
  const routes = (a.flightRoutes ?? []).filter((r) => r && (r.from || r.to));
  const fromLog = (a.flights ?? [])
    .filter((f) => f && (f.from || f.to))
    .map((f) => ({ from: f.from, to: f.to, date: f.date }));
  const seen = new Set<string>();
  return [...routes, ...fromLog].filter((r) => {
    const k = `${r.from ?? ""}>${r.to ?? ""}|${r.date ?? ""}`;
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });
}

/** Airport visit counts, preferring v1's precomputed airportData. */
export function airportCounts(a: V1Aircraft): [string, number][] {
  const pre = a.airportData;
  if (pre && typeof pre === "object" && Object.keys(pre).length)
    return Object.entries(pre).sort((x, y) => y[1] - x[1]);
  const counts: Record<string, number> = {};
  allRoutes(a).forEach((r) => {
    [r.from, r.to].forEach((c) => {
      if (c) counts[c] = (counts[c] ?? 0) + 1;
    });
  });
  return Object.entries(counts).sort((x, y) => y[1] - x[1]);
}

export const fmtMoney = (n: number) =>
  "$" + n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export const today = () => new Date().toISOString().slice(0, 10);

// Clock/id helpers live at module scope so components can call them without
// tripping the React Compiler's purity rule on inline Date.now() use.
export const nowMs = () => Date.now();

/** Storage-safe unique id, e.g. newId("sq") → "sq_1723570000000_4f2a". */
export const newId = (prefix: string) =>
  `${prefix}_${Date.now()}_${Math.random().toString(16).slice(2, 6)}`;

/** "2026-08" → "Aug", matching v1's month-name axis labels. */
export const monthLabel = (ym: string) => {
  const m = Number((ym ?? "").slice(5, 7));
  return Number.isFinite(m) && m >= 1 && m <= 12
    ? ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"][m - 1]
    : ym;
};

/** Whole days from now until an ISO date (negative = in the past). */
export const daysUntil = (iso: string) =>
  Math.round(
    (new Date(iso + "T12:00:00").getTime() - Date.now()) / 86_400_000,
  );

/**
 * Stable JSON for equality checks against a value that has round-tripped
 * through Postgres. jsonb does not preserve key order, so two equal blobs
 * routinely serialise differently under JSON.stringify; sorting every object's
 * keys makes the comparison mean what it looks like it means.
 */
export function canonical(v: unknown): string {
  const walk = (x: unknown): unknown => {
    if (Array.isArray(x)) return x.map(walk);
    if (x && typeof x === "object") {
      return Object.fromEntries(
        Object.keys(x as Record<string, unknown>)
          .sort()
          .map((k) => [k, walk((x as Record<string, unknown>)[k])]),
      );
    }
    return x;
  };
  return JSON.stringify(walk(v));
}

/**
 * How each meter is spoken about in the UI. Which meter an aircraft actually
 * runs on is per-aircraft (see MeterKind), so screens that show a reading must
 * name the aircraft's own meter rather than saying "Hobbs" and hoping.
 */
export const METER_LABEL: Record<MeterKind, string> = {
  hobbs: "Hobbs",
  tach: "Tach",
  flight: "Flight Time",
  total: "Total Time",
};
