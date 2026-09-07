import { NextResponse } from "next/server";

/**
 * Everything ADS-B Exchange hears within 250 nm of a point — one metered
 * request per home field, instead of one per aircraft. The hangar uses it as
 * the paid backstop for aircraft the free feed cannot hear: a fleet based at
 * one field is one call every five minutes, whatever its size. Aircraft away
 * from base and out of range fall back to their own registration check.
 */
export async function GET(_req: Request, ctx: { params: Promise<{ lat: string; lon: string }> }) {
  const { lat, lon } = await ctx.params;
  const la = Number(lat), lo = Number(lon);
  if (!Number.isFinite(la) || !Number.isFinite(lo) || Math.abs(la) > 90 || Math.abs(lo) > 180) {
    return NextResponse.json({ error: "bad point" }, { status: 400 });
  }
  const key = process.env.ADSBX_RAPIDAPI_KEY;
  if (!key) return NextResponse.json({ ac: [], source: null });
  try {
    // Two decimals (about half a mile) so every hangar looking at the same
    // field shares one cached answer.
    const res = await fetch(
      `https://adsbexchange-com1.p.rapidapi.com/v2/lat/${la.toFixed(2)}/lon/${lo.toFixed(2)}/dist/250/`,
      {
        headers: {
          accept: "application/json",
          "x-rapidapi-key": key,
          "x-rapidapi-host": "adsbexchange-com1.p.rapidapi.com",
        },
        next: { revalidate: 300 },
      },
    );
    if (!res.ok) return NextResponse.json({ error: `upstream ${res.status}` }, { status: 502 });
    const json = (await res.json()) as {
      ac?: { r?: string; hex?: string; lat?: number; lon?: number; alt_baro?: number | "ground"; seen_pos?: number }[];
    };
    const ac = (json.ac ?? [])
      .filter((a) => a.r && typeof a.lat === "number")
      .map((a) => ({ r: a.r!.toUpperCase(), hex: a.hex ?? null, alt_baro: a.alt_baro ?? null, seen_pos: a.seen_pos ?? null }));
    return NextResponse.json({ ac, source: "adsbx" });
  } catch {
    return NextResponse.json({ error: "upstream unreachable" }, { status: 502 });
  }
}
