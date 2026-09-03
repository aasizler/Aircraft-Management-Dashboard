import type { MeterKind } from "./types";
import { AIRCRAFT_DB, type AcClass } from "./reference-data";

/**
 * What clocks an airframe actually carries, and which one answers which
 * question. This exists because the two bases used to default to `hobbs` for
 * everything, which is a guess dressed up as a setting — and a wrong one for
 * most of the fleet. N137BF spent months with maintenance pointed at a Hobbs
 * reading 0.0 while the airframe had 6,969 hours on it.
 *
 * `has` is the physical panel, not a restriction: every kind stays selectable.
 * It only decides what gets offered first and what a new aircraft starts on.
 */
export type MeterProfile = {
  /** The clocks in the panel, most-referenced first. */
  has: MeterKind[];
  /** Inspections, SMOH, TBO, oil. */
  maint: MeterKind;
  /** Billing, utilization, $/hr. */
  cost: MeterKind;
  /** Why these two, in the owner's words. Shown under the fields. */
  note: string;
};

/** One hour meter, and everything runs off it. */
const SINGLE_HOBBS: MeterProfile = {
  has: ["hobbs"],
  maint: "hobbs",
  cost: "hobbs",
  note: "One hour meter in the panel — maintenance and costs both run off it.",
};

/**
 * One hour meter that runs on oil pressure or an airspeed switch rather than
 * master-on, so it counts time in the air, not time with the battery on.
 */
const SINGLE_FLIGHT: MeterProfile = {
  has: ["flight"],
  maint: "flight",
  cost: "flight",
  note: "A single panel clock that counts time in the air — it drives both.",
};

/** The classic legacy pairing: inspections on tach time, billing on Hobbs. */
const TACH_AND_HOBBS: MeterProfile = {
  has: ["tach", "hobbs"],
  maint: "tach",
  cost: "hobbs",
  note: "Tach time drives inspections; the Hobbs drives billing.",
};

/**
 * Glass panels log both separately. Flight time starts on the takeoff roll, so
 * it is the shorter number and the honest one to inspect against; total time is
 * master-on and is what an hour gets billed at.
 */
const GLASS_DUAL: MeterProfile = {
  has: ["flight", "total"],
  maint: "flight",
  cost: "total",
  note: "Two clocks in the avionics — maintenance runs on flight time, costs on total time.",
};

export const METER_PROFILES = { SINGLE_HOBBS, SINGLE_FLIGHT, TACH_AND_HOBBS, GLASS_DUAL };

/**
 * Per-type overrides, for airframes we know the panel of. Everything else
 * falls back to its class, so an untagged type behaves exactly as before.
 */
const BY_ICAO: Record<string, MeterProfile> = {
  // Perspective / Perspective+ keeps total time and flight time apart.
  SR20: GLASS_DUAL,
  SR22: GLASS_DUAL,
  SF50: GLASS_DUAL,
  // One clock, and it reads closer to time in the air than to master-on.
  BE33: SINGLE_FLIGHT,
  BE35: SINGLE_FLIGHT,
  BE36: SINGLE_FLIGHT,
};

/** Turbines log flight time in the avionics; pistons are assumed single-clock. */
const BY_CLASS: Record<AcClass, MeterProfile> = {
  piston: SINGLE_HOBBS,
  turboprop: GLASS_DUAL,
  jet: GLASS_DUAL,
};

export const profileForClass = (cls: AcClass = "piston") => BY_CLASS[cls];

/** Profile for a catalogue entry, by ICAO first and class second. */
export function profileFor(icao?: string | null, cls: AcClass = "piston"): MeterProfile {
  const hit = icao ? BY_ICAO[icao.toUpperCase()] : undefined;
  return hit ?? BY_CLASS[cls];
}

/**
 * Best-effort profile for an aircraft already in the hangar, whose type is the
 * free-text string v1 stored ("Cirrus SR22T", "Beechcraft A36 Bonanza") rather
 * than an ICAO code. Returns undefined when nothing in the catalogue plausibly
 * matches — there is nothing to suggest then, and guessing would be worse than
 * staying quiet.
 */
const squash = (v: string) => v.toUpperCase().replace(/[^A-Z0-9]/g, "");

export function profileForTypeString(
  type: string | null | undefined,
  cls: AcClass = "piston",
): MeterProfile | undefined {
  const raw = (type ?? "").trim();
  if (!raw) return undefined;
  const t = squash(raw);

  const of = (a: (typeof AIRCRAFT_DB)[number]) => profileFor(a.icao, a.cls ?? cls);

  // Exactly what the autocomplete writes, or a bare ICAO code.
  const exact = AIRCRAFT_DB.find(
    (a) => t === squash(`${a.mfr} ${a.model}`) || t === squash(a.icao),
  );
  if (exact) return of(exact);

  // Hand-typed. Require the manufacturer and a model word, so "Cirrus SR22T"
  // finds SR22 but "Cirrus SR20" never does. Longest model word wins, which
  // keeps Bonanza 33 from answering for a Bonanza 36.
  const near = AIRCRAFT_DB.map((a) => {
    if (!t.includes(squash(a.mfr))) return null;
    const word = a.model
      .split(/[^A-Za-z0-9]+/)
      .filter((w) => w.length > 1)
      .map(squash)
      .filter((w) => t.includes(w))
      .sort((x, y) => y.length - x.length)[0];
    return word ? { a, len: word.length } : null;
  }).filter((x): x is { a: (typeof AIRCRAFT_DB)[number]; len: number } => x != null);

  if (!near.length) return undefined;
  near.sort((x, y) => y.len - x.len);
  return of(near[0].a);
}

/** Profile kinds first, then the rest — never hide a choice, just order it. */
export const orderKinds = (p: MeterProfile, all: MeterKind[]): MeterKind[] => [
  ...p.has,
  ...all.filter((k) => !p.has.includes(k)),
];
