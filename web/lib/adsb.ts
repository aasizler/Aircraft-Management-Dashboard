"use client";

import { useCallback, useEffect, useRef, useState } from "react";

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
  /** Seconds since the feed last had a position for it. */
  ageS: number | null;
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
  seen_pos?: number;
};

function normalize(ac: RawAc, now: number): LiveState {
  const ground = ac.alt_baro === "ground";
  // seen_pos is relative to the feed's snapshot; the answer may have sat in
  // the edge cache for a couple of seconds since. Count that too, so the
  // fix's true age drives the marker rather than a too-recent one.
  const ageS = ac.seen_pos != null ? Math.max(0, ac.seen_pos + (Date.now() - now) / 1000) : null;
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
    ageS,
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
export type LiveSource = "adsbx" | "adsblol";
export const SOURCE_NAME: Record<LiveSource, string> = {
  adsbx: "ADS-B Exchange",
  adsblol: "adsb.lol",
};

export type LiveResult =
  | { ok: true; state: LiveState | null; source: LiveSource | null }
  | { ok: false; state: null; source: null };

/**
 * @param paid Allow the proxy to fall through to ADS-B Exchange (metered)
 *             when the free feed has nothing fresh. The proxy still asks the
 *             free feed first either way.
 */
async function fetchLive(reg: string, paid = false): Promise<LiveResult> {
  const key = (reg ?? "").trim().toUpperCase();
  // Not a registration at all — say the lookup failed rather than reporting a
  // silence nobody listened for.
  if (!/^[A-Z0-9-]{2,10}$/.test(key)) return { ok: false, state: null, source: null };
  try {
    const res = await fetch(`/api/adsb/${encodeURIComponent(key)}${paid ? "?paid=1" : ""}`);
    if (!res.ok) return { ok: false, state: null, source: null };
    const json = (await res.json()) as { ac?: RawAc[]; now?: number; error?: string; source?: LiveSource };
    if (json.error) return { ok: false, state: null, source: null };
    const source = json.source ?? null;
    if (!json.ac || !json.ac.length) return { ok: true, state: null, source };
    return { ok: true, state: normalize(json.ac[0], json.now ?? Date.now()), source };
  } catch {
    return { ok: false, state: null, source: null };
  }
}

export type LiveStatus = "searching" | "airborne" | "ground" | "none" | "error";

/** One recorded position along the current flight (v1 _adsbRecordTrack). */
export type TrackPoint = {
  lat: number; lon: number; alt: number | null; t: number;
  /** Groundspeed (kt) and true track (deg) at the fix, when the feed had them. */
  gs?: number | null; track?: number | null;
};

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
// Once a minute: wherever the free feed hears the aircraft, its trace carries a
// point every half-second in turns, which is what makes the line read as a
// curve. Five minutes left the last leg boxy for five minutes.
const SEED_EVERY = 60_000;
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
    const { pts } = (await res.json()) as {
      pts?: [number, number, number, number | null, boolean, number | null, number | null][];
    };
    if (!pts?.length) return null;
    let start = 0;
    for (let i = pts.length - 1; i > 0; i--) {
      if (pts[i][4] || pts[i][0] - pts[i - 1][0] > LEG_GAP_MS) { start = pts[i][4] ? i + 1 : i; break; }
    }
    const leg: TrackPoint[] = pts.slice(start).map(([t, lat, lon, alt, , gs, track]) => ({ t, lat, lon, alt, gs, track }));
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


/** How the poller spends: which feed it may ask, and how often. */
const RIBBON_MS = 10_000;       // aircraft page open, nothing on a map
const MAP_FREE_MS = 2_000;      // live map on screen, free feed hears it
const MAP_PAID_MS = 5_000;      // live map on screen, only the paid feed hears it
const PAID_BACKSTOP_MS = 120_000; // silent aircraft: ask the paid feed this often
const RECENT_AIR_MS = 15 * 60_000; // lost mid-flight: keep the paid feed allowed this long
const MAX_BACKOFF_MS = 60_000;

/**
 * Polls the live position while mounted, records the flown track, and reports
 * a landing when the aircraft goes from airborne to on-ground — which is what
 * v1 used to offer "log this flight?".
 *
 * Cost first. Nothing polls while the tab is hidden. The free feed carries
 * everything it can hear; ADS-B Exchange (metered) is allowed only when the
 * last answer came from it, or the aircraft was airborne recently and the
 * free feed has gone quiet, or as a two-minute backstop on a silent tail.
 * The cadence follows what is on screen: ten seconds for the ribbon, two on
 * a live map the free feed covers, five when only the paid feed does.
 */
export function useLivePosition(reg: string, onLanding?: (l: Landing) => void) {
  const [state, setState] = useState<LiveState | null>(null);
  const [status, setStatus] = useState<LiveStatus>("searching");
  const [track, setTrack] = useState<TrackPoint[]>([]);
  const [source, setSource] = useState<LiveSource | null>(null);

  // Keep the callback in a ref so changing it doesn't restart polling.
  const landingRef = useRef(onLanding);
  useEffect(() => { landingRef.current = onLanding; }, [onLanding]);

  // Whether a live map is on screen — set by the map from an
  // IntersectionObserver. Re-plans the next poll when it changes.
  const mapOnRef = useRef(false);
  const replanRef = useRef<() => void>(() => {});
  const setMapVisible = useCallback((on: boolean) => {
    if (mapOnRef.current === on) return;
    mapOnRef.current = on;
    replanRef.current();
  }, []);

  useEffect(() => {
    if (!reg) return;
    const key = reg.toUpperCase();
    let alive = true;
    let wasAirborne = false;
    let cur: LiveStatus = "searching";
    let lastSource: LiveSource | null = null;
    let lastPaidAt = 0;
    let lastAirAt = 0;
    let fails = 0;
    let timer: number | undefined;
    let inFlight = false;

    function plan(): { ms: number; paid: boolean } {
      const now = Date.now();
      const blind = lastSource === "adsbx";
      if (cur === "airborne") {
        if (blind) return { ms: mapOnRef.current ? MAP_PAID_MS : RIBBON_MS, paid: true };
        return { ms: mapOnRef.current ? MAP_FREE_MS : RIBBON_MS, paid: false };
      }
      const paid =
        blind || now - lastAirAt < RECENT_AIR_MS || now - lastPaidAt >= PAID_BACKSTOP_MS;
      const ms = fails ? Math.min(MAX_BACKOFF_MS, RIBBON_MS * 2 ** fails) : RIBBON_MS;
      return { ms, paid };
    }

    async function poll(paid: boolean) {
      if (inFlight) return;
      inFlight = true;
      if (paid) lastPaidAt = Date.now();
      const res = await fetchLive(key, paid);
      inFlight = false;
      if (!alive) return;
      const s = res.state;
      setSource(res.source);
      lastSource = res.source;

      if (!res.ok) {
        // Lookup failed — say so rather than claiming the aircraft is silent.
        fails++;
        setState(null);
        setStatus((cur = "error"));
        return;
      }
      fails = 0;

      if (!s || s.lat == null) {
        setState(null);
        setStatus((cur = "none"));
        return;
      }

      setState(s);
      const airborne = !s.onGround;
      setStatus((cur = airborne ? "airborne" : "ground"));

      if (airborne) {
        lastAirAt = Date.now();
        // Pull the leg flown so far from the feed's trace: once on the first
        // airborne fix, then every minute to densify the line and to fill any
        // gap left while the tab was hidden.
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
          const next = [...pts, {
            lat: s.lat, lon: s.lon!, alt: s.alt, t: Date.now() - (s.ageS ?? 0) * 1000,
            gs: s.gspd, track: s.track,
          }];
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

    function schedule() {
      window.clearTimeout(timer);
      if (!alive || document.visibilityState === "hidden") return;
      const { ms, paid } = plan();
      timer = window.setTimeout(() => run(paid), ms);
    }
    async function run(paid: boolean) {
      await poll(paid);
      schedule();
    }
    // Hidden tab: stop. Visible again: poll now, and let the next airborne
    // fix re-seed the trace to cover whatever was missed.
    const onVisibility = () => {
      window.clearTimeout(timer);
      if (document.visibilityState === "visible") {
        _seeded.set(key, 0);
        run(plan().paid);
      }
    };
    document.addEventListener("visibilitychange", onVisibility);
    replanRef.current = schedule;

    setTrack(_tracks.get(key) ?? []);
    run(plan().paid);
    return () => {
      alive = false;
      window.clearTimeout(timer);
      document.removeEventListener("visibilitychange", onVisibility);
      replanRef.current = () => {};
    };
  }, [reg]);

  return { state, status, track, source, setMapVisible };
}

/** Degrees of latitude per second at `gs` knots. */
const degPerSec = (gs: number) => gs / 3600 / 60;
/** Velocity in degrees per second: [dLat, dLon] for a track and speed at a latitude. */
export function velocityDeg(gs: number, trackDeg: number, lat: number): [number, number] {
  const v = degPerSec(gs), th = (trackDeg * Math.PI) / 180;
  return [v * Math.cos(th), (v * Math.sin(th)) / Math.max(0.05, Math.cos((lat * Math.PI) / 180))];
}

/**
 * The line ADS-B Exchange draws is straight segments between points a half
 * second apart in turns. Where our fixes are seconds apart, this bends each
 * segment to agree with the velocity the feed reported at both ends — a
 * cubic Hermite curve with the track-and-groundspeed vectors as tangents.
 * Nothing recorded moves; only the path between fixes is filled in, and only
 * where both fixes carry a velocity and the geometry is consistent with it.
 */
export function smoothTrack(pts: TrackPoint[]): TrackPoint[] {
  if (pts.length < 2) return pts;
  const out: TrackPoint[] = [pts[0]];
  for (let i = 1; i < pts.length; i++) {
    const a = pts[i - 1], b = pts[i];
    const T = (b.t - a.t) / 1000;
    const ok =
      T >= 1.5 && T <= 60 &&
      a.gs != null && a.track != null && b.gs != null && b.track != null &&
      a.gs > 15 && b.gs > 15;
    if (ok) {
      const [vLat0, vLon0] = velocityDeg(a.gs!, a.track!, a.lat);
      const [vLat1, vLon1] = velocityDeg(b.gs!, b.track!, b.lat);
      // Chord vs. what the speeds say was flown: if they disagree by more
      // than 2.5×, a tangent is stale and a curve would invent a detour.
      const chord = Math.hypot(b.lat - a.lat, (b.lon - a.lon) * Math.cos((a.lat * Math.PI) / 180));
      const flown = ((degPerSec(a.gs!) + degPerSec(b.gs!)) / 2) * T;
      if (chord > 1e-6 && flown / chord < 2.5 && chord / flown < 2.5) {
        const m0: [number, number] = [vLat0 * T, vLon0 * T];
        const m1: [number, number] = [vLat1 * T, vLon1 * T];
        const n = Math.min(12, Math.max(2, Math.round(T / 1.5)));
        for (let k = 1; k < n; k++) {
          const u = k / n, u2 = u * u, u3 = u2 * u;
          const h00 = 2 * u3 - 3 * u2 + 1, h10 = u3 - 2 * u2 + u, h01 = -2 * u3 + 3 * u2, h11 = u3 - u2;
          out.push({
            lat: h00 * a.lat + h10 * m0[0] + h01 * b.lat + h11 * m1[0],
            lon: h00 * a.lon + h10 * m0[1] + h01 * b.lon + h11 * m1[1],
            alt: a.alt != null && b.alt != null ? a.alt + (b.alt - a.alt) * u : (b.alt ?? a.alt),
            t: a.t + (b.t - a.t) * u,
          });
        }
      }
    }
    out.push(b);
  }
  return out;
}

export type FleetItem = { reg: string; base: { lat: number; lon: number } | null };

const FLEET_FREE_MS = 60_000;
const FLEET_PAID_MS = 5 * 60_000;
const FLEET_LONE_PAID_MS = 10 * 60_000;

/**
 * Airborne check for a whole fleet, driving the hangar's tile glyphs
 * (v1 _checkHangarAdsb / _applyTileAirborne).
 *
 * The free feed is asked per aircraft every minute. The paid feed is one
 * area query per home field every five minutes — everything ADS-B Exchange
 * hears within 250 nm of the field, whatever the fleet's size — and a lone
 * registration check every ten minutes for aircraft whose base could not be
 * resolved. Nothing runs while the tab is hidden.
 */
export function useFleetAirborne(items: FleetItem[]) {
  const [airborne, setAirborne] = useState<Record<string, boolean>>({});
  const key = JSON.stringify(
    items.map((i) => [i.reg, i.base ? [+i.base.lat.toFixed(2), +i.base.lon.toFixed(2)] : null]),
  );

  useEffect(() => {
    const list = (JSON.parse(key) as [string, [number, number] | null][]).filter(([r]) => r);
    if (!list.length) return;
    let alive = true;
    const free: Record<string, boolean> = {};
    const paid: Record<string, boolean> = {};
    const publish = () => {
      if (!alive) return;
      setAirborne(Object.fromEntries(list.map(([r]) => [r, !!(free[r] || paid[r])])));
    };
    const up = (res: LiveResult) =>
      res.ok && !!res.state && res.state.lat != null && !res.state.onGround;

    async function pollFree() {
      const results = await Promise.all(list.map(async ([r]) => [r, await fetchLive(r)] as const));
      if (!alive) return;
      for (const [r, res] of results) free[r] = up(res);
      publish();
    }

    async function pollPaid() {
      const bases = new Map<string, string[]>();
      const lone: string[] = [];
      for (const [r, b] of list) {
        if (b) bases.set(b.join(","), [...(bases.get(b.join(",")) ?? []), r]);
        else lone.push(r);
      }
      await Promise.all([
        ...[...bases].map(async ([b, regs]) => {
          try {
            const res = await fetch(`/api/adsb/near/${b.replace(",", "/")}`);
            if (!res.ok) return;
            const { ac } = (await res.json()) as {
              ac?: { r: string; alt_baro: number | "ground" | null; seen_pos: number | null }[];
            };
            const seen = new Map((ac ?? []).map((a) => [a.r, a]));
            for (const r of regs) {
              const a = seen.get(r.toUpperCase());
              paid[r] = !!a && a.alt_baro !== "ground" && (a.seen_pos ?? 0) < 120;
            }
          } catch { /* keep the last answer */ }
        }),
        ...lone.map(async (r) => {
          if (Date.now() - (lonePaidAt.get(r) ?? 0) < FLEET_LONE_PAID_MS) return;
          lonePaidAt.set(r, Date.now());
          paid[r] = up(await fetchLive(r, true));
        }),
      ]);
      publish();
    }
    const lonePaidAt = new Map<string, number>();

    let freeTimer: number | undefined, paidTimer: number | undefined;
    const start = () => {
      window.clearInterval(freeTimer); window.clearInterval(paidTimer);
      pollFree(); pollPaid();
      freeTimer = window.setInterval(pollFree, FLEET_FREE_MS);
      paidTimer = window.setInterval(pollPaid, FLEET_PAID_MS);
    };
    const stop = () => { window.clearInterval(freeTimer); window.clearInterval(paidTimer); };
    const onVisibility = () => (document.visibilityState === "visible" ? start() : stop());
    document.addEventListener("visibilitychange", onVisibility);
    if (document.visibilityState === "visible") start();
    return () => {
      alive = false;
      stop();
      document.removeEventListener("visibilitychange", onVisibility);
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
