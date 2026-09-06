import { NextResponse } from "next/server";

/**
 * Today's recorded trace for one ICAO hex, from adsb.lol's tar1090 globe.
 *
 * The live lookup only says where the aircraft is now, so a page opened
 * mid-flight had no track behind the aeroplane. The globe keeps the day's
 * trace at /data/traces/{last two hex digits}/trace_full_{hex}.json — each
 * point is [seconds after `timestamp`, lat, lon, alt_baro | "ground", gs,
 * track, flags, vert_rate, ...]. This trims it to what the map draws:
 * [ms, lat, lon, alt | null, onGround].
 *
 * The response is gzip; fetch inflates it. The hex comes from the live
 * lookup's `hex` field, never from a registration conversion.
 */
export type TracePoint = [number, number, number, number | null, boolean];

export async function GET(_req: Request, ctx: { params: Promise<{ hex: string }> }) {
  const { hex } = await ctx.params;
  const h = hex.toLowerCase();
  if (!/^[0-9a-f]{6}$/.test(h)) {
    return NextResponse.json({ error: "bad hex" }, { status: 400 });
  }
  try {
    const res = await fetch(`https://adsb.lol/data/traces/${h.slice(-2)}/trace_full_${h}.json`, {
      headers: {
        accept: "application/json",
        "user-agent": "AeroTrack/1.0 (+https://aerotrack-next.vercel.app)",
      },
      next: { revalidate: 30 },
    });
    // No trace file: the aircraft has not been seen today. That is an empty
    // track, not a failure.
    if (res.status === 404) return NextResponse.json({ ts: null, pts: [] });
    if (!res.ok) return NextResponse.json({ error: `upstream ${res.status}` }, { status: 502 });
    const json = (await res.json()) as {
      timestamp?: number;
      trace?: [number, number, number, number | "ground" | null, ...unknown[]][];
    };
    const ts = json.timestamp ?? 0;
    const pts: TracePoint[] = (json.trace ?? [])
      .filter((p) => typeof p[1] === "number" && typeof p[2] === "number")
      .map((p) => [
        Math.round((ts + p[0]) * 1000),
        p[1],
        p[2],
        typeof p[3] === "number" ? p[3] : null,
        p[3] === "ground",
      ]);
    return NextResponse.json({ ts, pts });
  } catch {
    return NextResponse.json({ error: "upstream unreachable" }, { status: 502 });
  }
}
