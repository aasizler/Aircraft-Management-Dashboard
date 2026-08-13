import type { MeterKind } from "./types";

// The v1 aircraft object, carried inside aircraft.data. Loosely typed — it is
// the same shape the HTML app used, ported as-is.
export type V1Aircraft = Record<string, unknown> & {
  inspections?: Insp[];
  oil?: OilEntry[];
  flights?: FlightEntry[];
  schedule?: SchedEvent[];
  insurance?: Record<string, unknown>;
  engineSMOH?: number;
  tbo?: number;
  oilInterval?: number;
  oilHobbs?: number;
  oilChangeDate?: string;
};

export type Insp = {
  name: string;
  core?: boolean;
  lastDate?: string | null;
  lastHobbs?: number | null;
  intervalHrs?: number | null;
  intervalDays?: number | null;
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

export type AircraftRow = {
  id: string;
  reg: string;
  type: string | null;
  airport: string | null;
  serial: string | null;
  maint_basis: MeterKind;
  cost_basis: MeterKind;
  data: V1Aircraft;
};

export type Meter = { kind: MeterKind; current: number; label: string | null };

export const meterValue = (meters: Meter[], kind: MeterKind) =>
  meters.find((m) => m.kind === kind)?.current ?? 0;

// Calendar-interval due date using end-of-month logic (matches v1 calMonthDue).
function calMonthDue(lastDate: string, days: number): Date {
  const base = new Date(lastDate + "T12:00:00");
  const d = new Date(base);
  d.setDate(d.getDate() + days);
  // Snap to the end of that month, as the original does for 30/365/730-day cycles.
  return new Date(d.getFullYear(), d.getMonth() + 1, 0, 12, 0, 0);
}

// Ported from ic() in aerotrack_v1_07_3_6.html — but hours are measured against
// the aircraft's declared maintenance clock (maintHrs), NOT Math.max(hobbs,tt),
// which is the v1 bug for aircraft whose maintenance basis is the smaller meter.
export function ic(i: Insp, maintHrs: number) {
  if (!i.lastDate && !i.populated)
    return { p: 0, s: "ok" as const, nl: "—", remNum: "—", remUnit: "", remFoot: "" };

  let p = 0,
    nl = "",
    s: "ok" | "warn" | "overdue" = "ok",
    remNum: string | number = "",
    remUnit = "",
    remFoot = "";
  const t = Date.now();

  if (i.intervalHrs && i.lastHobbs != null) {
    const u = maintHrs - (i.lastHobbs || 0);
    p = Math.min(100, (u / i.intervalHrs) * 100);
    const rem = Math.max(0, i.intervalHrs - u);
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

  if (i.intervalDays && i.lastDate) {
    const nx = calMonthDue(i.lastDate, i.intervalDays);
    const totalMs = nx.getTime() - new Date(i.lastDate + "T12:00:00").getTime();
    const elapsedMs = t - new Date(i.lastDate + "T12:00:00").getTime();
    const dp = Math.min(100, (elapsedMs / totalMs) * 100);
    if (dp > p) {
      p = dp;
      const dl = Math.round((nx.getTime() - t) / 86_400_000);
      const dateStr = nx.toISOString().slice(0, 10);
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

  if (p >= 100) s = "overdue";
  else if (p >= 80) s = "warn";
  return { p, s, nl, remNum, remUnit, remFoot };
}

// Oil life, ported from oilLife(). Counts up from the last oil change against the
// declared maintenance clock.
export function oilLife(a: V1Aircraft, maintHrs: number) {
  const interval = a.oilInterval || 50;
  const base = a.oilHobbs ?? 0;
  const used = Math.max(0, maintHrs - base);
  const hrsLeft = interval - used;
  const pct = Math.max(0, Math.min(100, (hrsLeft / interval) * 100));
  return { pct, hrsLeft, used, interval, overdueHrs: hrsLeft < 0 ? -hrsLeft : 0 };
}
