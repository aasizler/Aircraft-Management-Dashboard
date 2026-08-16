"use client";

import { useEffect, useRef, useState } from "react";

// FAA N-number → ICAO Mode-S hex. Ported verbatim from _nToHex() in the HTML.
export function nToHex(nNum: string): string | null {
  const raw = (nNum || "").trim().toUpperCase().replace(/^N/, "");
  if (!raw) return null;
  const ALPHA = "ABCDEFGHJKLMNPQRSTUVWXYZ"; // 24 chars — no I, O
  const parts = raw.match(/^([0-9]{1,5})([A-HJ-NP-Z]?)([A-HJ-NP-Z]?)$/);
  if (!parts) return null;
  const num = parseInt(parts[1], 10);
  if (num < 1 || num > 99999) return null;
  const s1 = parts[2] || "",
    s2 = parts[3] || "";
  const i1 = s1 ? ALPHA.indexOf(s1) + 1 : 0,
    i2 = s2 ? ALPHA.indexOf(s2) + 1 : 0;
  const BASE = 0xa00001,
    SLOTS = 601;
  const sufOff = i1 > 0 ? 1 + (i1 - 1) * 25 + (i2 > 0 ? i2 : 0) : 0;
  return (BASE + (num - 1) * SLOTS + sufOff).toString(16).toLowerCase();
}

export type LiveState = {
  lat: number | null;
  lon: number | null;
  alt: number | null; // ft, null when on ground
  onGround: boolean;
  gspd: number | null; // kt
  track: number | null; // deg
  vspd: number | null; // fpm
  squawk: string | null;
  callsign: string | null;
};

type RawAc = {
  lat?: number;
  lon?: number;
  alt_baro?: number | "ground";
  gs?: number;
  track?: number;
  baro_rate?: number;
  squawk?: string;
  flight?: string;
};

function normalize(ac: RawAc): LiveState {
  const ground = ac.alt_baro === "ground";
  return {
    lat: ac.lat ?? null,
    lon: ac.lon ?? null,
    alt: ground ? null : typeof ac.alt_baro === "number" ? ac.alt_baro : null,
    onGround: ground,
    gspd: ac.gs ?? null,
    track: ac.track ?? null,
    vspd: ac.baro_rate ?? null,
    squawk: ac.squawk ?? null,
    callsign: ac.flight?.trim() ?? null,
  };
}

// Keyless live position by hex from adsb.lol (same feed as the flight monitor).
export async function fetchLive(reg: string): Promise<LiveState | null> {
  const hex = nToHex(reg);
  if (!hex) return null;
  try {
    const res = await fetch(`https://api.adsb.lol/v2/hex/${hex}`);
    if (!res.ok) return null;
    const json = (await res.json()) as { ac?: RawAc[] };
    if (!json.ac || !json.ac.length) return null;
    return normalize(json.ac[0]);
  } catch {
    return null;
  }
}

export type LiveStatus = "searching" | "airborne" | "ground" | "none";

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
const MAX_POINTS = 900; // ~2.5h at a 10s cadence

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
      const s = await fetchLive(key);
      if (!alive) return;

      if (!s || s.lat == null) {
        setState(null);
        setStatus("none");
        return;
      }

      setState(s);
      const airborne = !s.onGround;
      setStatus(airborne ? "airborne" : "ground");

      if (airborne) {
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
          results.map(([r, s]) => [r, !!s && s.lat != null && !s.onGround]),
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

/** Altitude → colour ramp, ported from v1's _altColor(). */
export function altColor(alt: number | null): string {
  const a = alt ?? 0;
  if (a <= 0) return "#8a8a8a";
  if (a < 1000) return "#00e164";
  if (a < 3000) return "#7ddc00";
  if (a < 6000) return "#d4d400";
  if (a < 10000) return "#f5a623";
  if (a < 18000) return "#f0644b";
  return "#c04bf0";
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
