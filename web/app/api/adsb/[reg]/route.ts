import { NextResponse } from "next/server";

/**
 * Server-side proxy for adsb.lol, keyed on the registration.
 *
 * The browser cannot call api.adsb.lol directly: it answers 200 with valid JSON
 * but sends no Access-Control-Allow-Origin header on ANY response — verified
 * against both a parked aircraft and one airborne at 8,550 ft. So every live
 * lookup failed in the browser and the banner reported "not broadcasting" for
 * what was actually a blocked request. Server-side fetch has no such check.
 *
 * This used to convert the N-number to an ICAO Mode-S hex first and look that
 * up. The conversion was wrong — checked against 1,682 registrations reported
 * by the live feed, it got none of them right, and for numbers like N36120 it
 * produced seven hex digits, which this route then rejected as malformed. The
 * feed indexes by registration directly, so there is nothing to convert and no
 * arithmetic to be wrong. It also means a non-US registration now works.
 *
 * Returns { ac: [...] } on success and { error: "..." } when the upstream is
 * unreachable, so the client can tell "not transmitting" from "lookup failed".
 */
export async function GET(_req: Request, ctx: { params: Promise<{ reg: string }> }) {
  const { reg } = await ctx.params;
  // Registrations are letters, digits and hyphens. Anything else is not one,
  // and must not be passed upstream.
  if (!/^[A-Z0-9-]{2,10}$/i.test(reg)) {
    return NextResponse.json({ error: "bad registration" }, { status: 400 });
  }

  try {
    const res = await fetch(`https://api.adsb.lol/v2/reg/${encodeURIComponent(reg.toUpperCase())}`, {
      headers: {
        accept: "application/json",
        // adsb.lol 403s the default Node fetch User-Agent ("node") and an empty
        // one; it wants callers to identify themselves. Verified: "node" -> 403,
        // a descriptive string -> 200, which is why this worked locally (curl's
        // own UA) and failed on Vercel.
        "user-agent": "AeroTrack/1.0 (+https://aerotrack-next.vercel.app)",
      },
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
