"use client";

import { useEffect, useState } from "react";

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

// Polls live position every 10s while mounted.
export function useLivePosition(reg: string) {
  const [state, setState] = useState<LiveState | null>(null);
  const [status, setStatus] = useState<LiveStatus>("searching");

  useEffect(() => {
    let alive = true;
    let timer: ReturnType<typeof setInterval>;

    async function poll() {
      const s = await fetchLive(reg);
      if (!alive) return;
      if (!s || s.lat == null) {
        setState(null);
        setStatus("none");
      } else {
        setState(s);
        setStatus(s.onGround ? "ground" : "airborne");
      }
    }

    poll();
    timer = setInterval(poll, 10_000);
    return () => {
      alive = false;
      clearInterval(timer);
    };
  }, [reg]);

  return { state, status };
}
