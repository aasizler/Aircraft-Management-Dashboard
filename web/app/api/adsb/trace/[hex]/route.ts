import { NextResponse } from "next/server";

/**
 * Today's recorded trace for one ICAO hex, from adsb.lol's tar1090 globe.
 *
 * The live lookup only says where the aircraft is now, so a page opened
 * mid-flight had no track behind the aeroplane. The globe keeps the day's
 * trace at /data/traces/{last two hex digits}/trace_full_{hex}.json — each
 * point is [seconds after `timestamp`, lat, lon, alt_baro | "ground", gs,
 * track, flags, vert_rate, ...]. This trims it to what the map draws:
 * [ms, lat, lon, alt | null, onGround, gs | null, track | null] — speed and
 * track ride along so the drawn line can bend to the velocity at each fix.
 *
 * Two files, merged. trace_full is the whole day but the globe rewrites it
 * lazily — mid-flight its last point can be minutes old — while
 * trace_recent holds the last stretch at full resolution and is written
 * every few seconds. Reading only trace_full left a minutes-long hole
 * between where the trace ended and the aircraft's live position, which
 * the map bridged with a dashed "no data" line until the next merge. v1
 * read both for the same reason.
 *
 * The response is gzip; fetch inflates it. The hex comes from the live
 * lookup's `hex` field, never from a registration conversion.
 */
export type TracePoint = [number, number, number, number | null, boolean, number | null, number | null];

export async function GET(_req: Request, ctx: { params: Promise<{ hex: string }> }) {
  const { hex } = await ctx.params;
  const h = hex.toLowerCase();
  if (!/^[0-9a-f]{6}$/.test(h)) {
    return NextResponse.json({ error: "bad hex" }, { status: 400 });
  }
  try {
    const UA = "AeroTrack/1.0 (+https://aerotrack-next.vercel.app)";
    type Raw = { timestamp?: number; trace?: [number, number, number, number | "ground" | null, ...unknown[]][] };
    const get = async (name: string, revalidate: number): Promise<Raw | null | "missing"> => {
      const res = await fetch(`https://adsb.lol/data/traces/${h.slice(-2)}/${name}_${h}.json`, {
        headers: { accept: "application/json", "user-agent": UA },
        next: { revalidate },
      });
      if (res.status === 404) return "missing";
      if (!res.ok) return null;
      return (await res.json()) as Raw;
    };
    const [full, recent] = await Promise.all([get("trace_full", 30), get("trace_recent", 5)]);
    // No trace file at all: the aircraft has not been seen today. That is an
    // empty track, not a failure.
    if (full === "missing" && recent === "missing") return NextResponse.json({ ts: null, pts: [] });
    if (!full && !recent) return NextResponse.json({ error: "upstream unreachable" }, { status: 502 });

    const byT = new Map<number, TracePoint>();
    for (const raw of [full, recent]) {
      if (!raw || raw === "missing") continue;
      const ts = raw.timestamp ?? 0;
      for (const p of raw.trace ?? []) {
        if (typeof p[1] !== "number" || typeof p[2] !== "number") continue;
        const t = Math.round((ts + p[0]) * 1000);
        byT.set(t, [
          t, p[1], p[2],
          typeof p[3] === "number" ? p[3] : null,
          p[3] === "ground",
          typeof p[4] === "number" ? p[4] : null,
          typeof p[5] === "number" ? p[5] : null,
        ]);
      }
    }
    const pts = [...byT.values()].sort((a, b) => a[0] - b[0]);
    const ts = (recent && recent !== "missing" ? recent.timestamp : full && full !== "missing" ? full.timestamp : 0) ?? 0;
    return NextResponse.json({ ts, pts });
  } catch {
    return NextResponse.json({ error: "upstream unreachable" }, { status: 502 });
  }
}
