"use client";

import { useEffect, useRef, useState } from "react";

/**
 * The FAA N-number → ICAO Mode-S hex conversion that used to live here has been
 * removed. It was ported from v1 and was simply wrong: checked against 1,682
 * registrations the live feed reported for real aircraft, it matched none of
 * them, and for five-digit numbers like N36120 it returned seven hex digits,
 * which the proxy then rejected as malformed. Every lookup failed, and a failed
 * lookup for an unmappable registration was reported as "not transmitting".
 *
 * adsb.lol indexes by registration, so nothing needs converting.
 */

export type LiveState = {
  /** ICAO Mode-S hex, as the feed reports it; keys the recorded trace. */
  hex: string | null;
  lat: number | null;
  lon: number | null;
  alt: number | null; // ft, null when on ground
  onGround: boolean;
  gspd: number | null; // kt
  track: number | null; // deg, true track over the ground
  heading: number | null; // deg, true heading — where the nose points
  vspd: number | null; // fpm
  squawk: string | null;
  callsign: string | null;
};

type RawAc = {
  hex?: string;
  lat?: number;
  lon?: number;
  alt_baro?: number | "ground";
  gs?: number;
  track?: number;
  true_heading?: number;
  baro_rate?: number;
  squawk?: string;
  flight?: string;
};

function normalize(ac: RawAc): LiveState {
  const ground = ac.alt_baro === "ground";
  return {
    hex: ac.hex?.toLowerCase() ?? null,
    lat: ac.lat ?? null,
    lon: ac.lon ?? null,
    alt: ground ? null : typeof ac.alt_baro === "number" ? ac.alt_baro : null,
    onGround: ground,
    gspd: ac.gs ?? null,
    track: ac.track ?? null,
    heading: ac.true_heading ?? null,
    vspd: ac.baro_rate ?? null,
    squawk: ac.squawk ?? null,
    callsign: ac.flight?.trim() ?? null,
  };
}

/**
 * Live position by hex, via our own /api/adsb proxy.
 *
 * This used to call https://api.adsb.lol directly from the browser. It never
 * worked: adsb.lol answers 200 with valid JSON but sends no CORS headers on any
 * response, so every lookup threw and the UI reported "not broadcasting" for
 * what was really a blocked request.
 *
 * The result distinguishes the two so callers can stop asserting a negative
 * they never actually observed.
 */
export type LiveResult =
  | { ok: true; state: LiveState | null }
  | { ok: false; state: null };

export async function fetchLive(reg: string): Promise<LiveResult> {
  const key = (reg ?? "").trim().toUpperCase();
  // Not a registration at all — say the lookup failed rather than reporting a
  // silence nobody listened for.
  if (!/^[A-Z0-9-]{2,10}$/.test(key)) return { ok: false, state: null };
  try {
    const res = await fetch(`/api/adsb/${encodeURIComponent(key)}`);
    if (!res.ok) return { ok: false, state: null };
    const json = (await res.json()) as { ac?: RawAc[]; error?: string };
    if (json.error) return { ok: false, state: null };
    if (!json.ac || !json.ac.length) return { ok: true, state: null };
    return { ok: true, state: normalize(json.ac[0]) };
  } catch {
    return { ok: false, state: null };
  }
}

export type LiveStatus = "searching" | "airborne" | "ground" | "none" | "error";

/** One recorded position along the current flight (v1 _adsbRecordTrack). */
export type TrackPoint = { lat: number; lon: number; alt: number | null; t: number };

/** Emitted when the aircraft transitions airborne → on-ground (v1 _adsbCheckLanding). */
export type Landing = {
  track: TrackPoint[];
  maxAlt: number;
  durationH: number;
  startedAt: number;
  endedAt: number;
};

// Track points are kept per-registration at module scope so they survive tab
// switches — v1 held them in a module-level `_adsbTrack`.
const _tracks = new Map<string, TrackPoint[]>();
const MAX_POINTS = 4000; // a long day at the feed's cadence
// When the feed's trace was last merged in, per registration.
const _seeded = new Map<string, number>();
const SEED_EVERY = 5 * 60_000;
// A gap this long between trace points separates one flight from the next.
const LEG_GAP_MS = 15 * 60_000;

/**
 * Merge the current flight's leg from the feed's recorded trace into the
 * track (v1 only ever had what it polled itself, so a page opened mid-flight
 * showed nothing behind the aeroplane). The trace is the whole day; the leg
 * is everything after the last on-ground point or the last long gap.
 */
async function seedTrack(key: string, hex: string): Promise<TrackPoint[] | null> {
  try {
    const res = await fetch(`/api/adsb/trace/${hex}`);
    if (!res.ok) return null;
    const { pts } = (await res.json()) as { pts?: [number, number, number, number | null, boolean][] };
    if (!pts?.length) return null;
    let start = 0;
    for (let i = pts.length - 1; i > 0; i--) {
      if (pts[i][4] || pts[i][0] - pts[i - 1][0] > LEG_GAP_MS) { start = pts[i][4] ? i + 1 : i; break; }
    }
    const leg: TrackPoint[] = pts.slice(start).map(([t, lat, lon, alt]) => ({ t, lat, lon, alt }));
    if (leg.length < 2) return null;
    // Keep any fix of our own that is newer than the trace, then sort and cap.
    const newest = leg[leg.length - 1].t;
    const own = (_tracks.get(key) ?? []).filter((p) => p.t > newest + 1000);
    const merged = [...leg, ...own].sort((a, b) => a.t - b.t).slice(-MAX_POINTS);
    _tracks.set(key, merged);
    return merged;
  } catch {
    return null;
  }
}

export const getTrack = (reg: string): TrackPoint[] => _tracks.get(reg.toUpperCase()) ?? [];
export const clearTrack = (reg: string) => _tracks.delete(reg.toUpperCase());

/**
 * Polls live position every 10s while mounted, records the flown track, and
 * reports a landing when the aircraft goes from airborne to on-ground — which
 * is what v1 used to offer "log this flight?".
 */
export function useLivePosition(reg: string, onLanding?: (l: Landing) => void) {
  const [state, setState] = useState<LiveState | null>(null);
  const [status, setStatus] = useState<LiveStatus>("searching");
  const [track, setTrack] = useState<TrackPoint[]>([]);

  // Keep the callback in a ref so changing it doesn't restart polling.
  const landingRef = useRef(onLanding);
  useEffect(() => { landingRef.current = onLanding; }, [onLanding]);

  useEffect(() => {
    if (!reg) return;
    const key = reg.toUpperCase();
    let alive = true;
    let wasAirborne = false;

    async function poll() {
      const res = await fetchLive(key);
      if (!alive) return;
      const s = res.state;

      if (!res.ok) {
        // Lookup failed — say so rather than claiming the aircraft is silent.
        setState(null);
        setStatus("error");
        return;
      }

      if (!s || s.lat == null) {
        setState(null);
        setStatus("none");
        return;
      }

      setState(s);
      const airborne = !s.onGround;
      setStatus(airborne ? "airborne" : "ground");

      if (airborne) {
        // Pull the leg flown so far from the feed's trace: once on the first
        // airborne fix, then every few minutes to fill any gap left while a
        // background tab's timers were throttled.
        const seededAt = _seeded.get(key) ?? 0;
        if (s.hex && Date.now() - seededAt > SEED_EVERY) {
          _seeded.set(key, Date.now());
          seedTrack(key, s.hex).then((merged) => {
            if (alive && merged) setTrack(merged);
          });
        }
        const pts = _tracks.get(key) ?? [];
        const last = pts[pts.length - 1];
        // Skip duplicate fixes so a parked-but-transmitting aircraft doesn't
        // accumulate thousands of identical points.
        if (!last || last.lat !== s.lat || last.lon !== s.lon) {
          const next = [...pts, { lat: s.lat, lon: s.lon!, alt: s.alt, t: Date.now() }];
          _tracks.set(key, next.slice(-MAX_POINTS));
          setTrack(_tracks.get(key)!);
        }
        wasAirborne = true;
      } else if (wasAirborne) {
        // Airborne → ground: a landing.
        const pts = _tracks.get(key) ?? [];
        wasAirborne = false;
        if (pts.length > 3) {
          const alts = pts.map((p) => p.alt ?? 0);
          landingRef.current?.({
            track: pts,
            maxAlt: Math.max(...alts),
            durationH: (pts[pts.length - 1].t - pts[0].t) / 3_600_000,
            startedAt: pts[0].t,
            endedAt: pts[pts.length - 1].t,
          });
        }
      }
    }

    setTrack(_tracks.get(key) ?? []);
    poll();
    const timer = setInterval(poll, 10_000);
    return () => {
      alive = false;
      clearInterval(timer);
    };
  }, [reg]);

  return { state, status, track };
}

/**
 * Airborne check for a whole fleet, driving the hangar's LIVE badges
 * (v1 _checkHangarAdsb / _applyTileAirborne). Polls every 60s — the hangar
 * doesn't need the detail view's cadence.
 */
export function useFleetAirborne(regs: string[]) {
  const [airborne, setAirborne] = useState<Record<string, boolean>>({});
  const key = regs.join(",");

  useEffect(() => {
    if (!key) return;
    const list = key.split(",").filter(Boolean);
    let alive = true;

    async function poll() {
      const results = await Promise.all(
        list.map(async (r) => [r, await fetchLive(r)] as const),
      );
      if (!alive) return;
      setAirborne(
        Object.fromEntries(
          results.map(([r, res]) => [
            r,
            res.ok && !!res.state && res.state.lat != null && !res.state.onGround,
          ]),
        ),
      );
    }

    poll();
    const timer = setInterval(poll, 60_000);
    return () => {
      alive = false;
      clearInterval(timer);
    };
  }, [key]);

  return airborne;
}

/**
 * Altitude → colour, on the same scale ADS-B Exchange's globe view uses.
 *
 * That view is tar1090 (GPL-2+, github.com/wiedehopf/tar1090), whose default
 * ColorByAlt is a hue ramp by altitude at 88% saturation, with lightness
 * tuned per hue so yellows don't wash out and blues don't go dark. The
 * breakpoints below are that scale; the interpolation is our own.
 */
const ALT_HUE: [number, number][] = [
  [0, 20], [2000, 32.5], [4000, 43], [6000, 54], [8000, 72], [9000, 85],
  [11000, 140], [40000, 300], [51000, 360],
];
const HUE_LIGHT: [number, number][] = [
  [0, 53], [20, 50], [32, 54], [40, 52], [46, 51], [50, 46], [60, 43], [80, 41],
  [100, 41], [120, 41], [140, 41], [160, 40], [180, 40], [190, 44], [198, 50],
  [200, 58], [220, 58], [240, 58], [255, 55], [266, 55], [270, 58], [280, 58],
  [290, 47], [300, 43], [310, 48], [320, 48], [340, 52], [360, 53],
];

/** Piecewise-linear lookup; clamps to the end values outside the table. */
function lerpTable(table: [number, number][], x: number): number {
  if (x <= table[0][0]) return table[0][1];
  for (let i = 1; i < table.length; i++) {
    const [x1, y1] = table[i];
    if (x <= x1) {
      const [x0, y0] = table[i - 1];
      return y0 + ((x - x0) / (x1 - x0)) * (y1 - y0);
    }
  }
  return table[table.length - 1][1];
}

export function altColor(alt: number | null): string {
  if (alt == null) return "hsl(0, 0%, 75%)"; // unknown
  if (alt <= 0) return "hsl(220, 0%, 30%)"; // on the ground
  const h = lerpTable(ALT_HUE, alt);
  const l = lerpTable(HUE_LIGHT, h);
  return `hsl(${h.toFixed(1)}, 88%, ${l.toFixed(1)}%)`;
}

/** Nearest airport code to a position, from a code→coords table (v1 _nearestAirport). */
export function nearestAirport(
  lat: number,
  lon: number,
  table: Record<string, { lat: number; lon: number }>,
  maxNm = 12,
): string | null {
  let best: string | null = null;
  let bestD = Infinity;
  for (const [code, p] of Object.entries(table)) {
    const dLat = (p.lat - lat) * 60;
    const dLon = (p.lon - lon) * 60 * Math.cos((lat * Math.PI) / 180);
    const d = Math.hypot(dLat, dLon);
    if (d < bestD) { bestD = d; best = code; }
  }
  return bestD <= maxNm ? best : null;
}
