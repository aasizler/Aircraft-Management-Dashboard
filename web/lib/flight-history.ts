"use client";

import { createClient } from "@/lib/supabase/client";
import type { TrackPoint } from "@/lib/adsb";

/**
 * flight_history access, ported from v1's _pullFlightHistory() and
 * _ensureLastFlightTrack(). The table is written by the flight-monitor edge
 * function and, now, by the browser when it observes a landing itself
 * (v1's _pushLiveFlight).
 *
 * `track` is deliberately excluded from list queries — it is a jsonb blob per
 * flight, and v1 lazy-loaded it only when the replay was switched on.
 */

export type FlightHistoryRow = {
  id: string;
  reg: string;
  dep_code: string | null;
  arr_code: string | null;
  dep_ts: string | null;
  arr_ts: string | null;
  duration_h: number | null;
  max_alt: number | null;
  distance_nm: number | null;
  point_count: number | null;
};

/** Most recent recorded flights for a registration, newest first. */
export async function listFlightHistory(reg: string, limit = 20) {
  const { data, error } = await createClient()
    .from("flight_history")
    .select("id, reg, dep_code, arr_code, dep_ts, arr_ts, duration_h, max_alt, distance_nm, point_count")
    .eq("reg", reg.toUpperCase())
    .order("arr_ts", { ascending: false, nullsFirst: false })
    .limit(limit);
  if (error) return [];
  return (data ?? []) as FlightHistoryRow[];
}

/** Lazily fetches the decimated track for one flight (v1 _ensureLastFlightTrack). */
export async function getFlightTrack(id: string): Promise<TrackPoint[]> {
  const { data, error } = await createClient()
    .from("flight_history")
    .select("track")
    .eq("id", id)
    .maybeSingle();
  if (error || !data?.track) return [];
  const raw = data.track as { lat: number; lon: number; alt?: number; ts?: number }[];
  return raw
    .filter((p) => typeof p?.lat === "number" && typeof p?.lon === "number")
    .map((p) => ({ lat: p.lat, lon: p.lon, alt: p.alt ?? null, t: p.ts ?? 0 }));
}

/**
 * Records a flight the browser watched land — v1's _pushLiveFlight(). The
 * edge-function monitor covers the case where nobody has the app open; this
 * covers the case where they do, so a tracked flight is never lost.
 */
export async function pushLiveFlight(args: {
  reg: string;
  aircraftId: string;
  track: TrackPoint[];
  maxAlt: number;
  durationH: number;
  depCode?: string | null;
  arrCode?: string | null;
}) {
  const { track } = args;
  if (track.length < 2) return;
  const supabase = createClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return;

  const first = track[0];
  const last = track[track.length - 1];

  await supabase.from("flight_history").insert({
    user_id: auth.user.id,
    aircraft_id: args.aircraftId,
    reg: args.reg.toUpperCase(),
    dep_code: args.depCode ?? null,
    arr_code: args.arrCode ?? null,
    dep_lat: first.lat, dep_lon: first.lon,
    arr_lat: last.lat, arr_lon: last.lon,
    dep_ts: new Date(first.t).toISOString(),
    arr_ts: new Date(last.t).toISOString(),
    duration_h: Number(args.durationH.toFixed(2)),
    max_alt: Math.round(args.maxAlt),
    point_count: track.length,
    track: track.map((p) => ({ lat: p.lat, lon: p.lon, alt: p.alt, ts: p.t })),
  });
}
