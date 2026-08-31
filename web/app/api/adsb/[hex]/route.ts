import { NextResponse } from "next/server";

/**
 * Server-side proxy for adsb.lol.
 *
 * The browser cannot call api.adsb.lol directly: it answers 200 with valid JSON
 * but sends no Access-Control-Allow-Origin header on ANY response — verified
 * against both a parked aircraft and one airborne at 8,550 ft. So every live
 * lookup failed in the browser and the banner reported "not broadcasting" for
 * what was actually a blocked request. Server-side fetch has no such check.
 *
 * Returns { ac: [...] } on success and { error: "..." } when the upstream is
 * unreachable, so the client can tell "not transmitting" from "lookup failed".
 */
export async function GET(_req: Request, ctx: { params: Promise<{ hex: string }> }) {
  const { hex } = await ctx.params;
  if (!/^[0-9a-f]{6}$/i.test(hex)) {
    return NextResponse.json({ error: "bad hex" }, { status: 400 });
  }

  try {
    const res = await fetch(`https://api.adsb.lol/v2/hex/${hex.toLowerCase()}`, {
      headers: { accept: "application/json" },
      // The feed updates every second; 5s of edge caching collapses the polling
      // of several tabs onto one upstream call without going stale.
      next: { revalidate: 5 },
    });
    if (!res.ok) {
      return NextResponse.json({ error: `upstream ${res.status}` }, { status: 502 });
    }
    const json = await res.json();
    return NextResponse.json({ ac: json.ac ?? [] });
  } catch {
    return NextResponse.json({ error: "upstream unreachable" }, { status: 502 });
  }
}
