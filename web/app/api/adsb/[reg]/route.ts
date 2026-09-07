import { NextResponse } from "next/server";

/**
 * Server-side proxy for the live feed, keyed on the registration.
 *
 * ADS-B Exchange first, when ADSBX_RAPIDAPI_KEY is set: its receiver network is
 * the densest of the feeds, and it saw an RV-12 on final into Venice at 125 ft
 * that adsb.lol and adsb.fi never heard at all. adsb.lol is the fallback — no
 * key, and what the app ran on before the key was wired in. Both answer in
 * readsb's aircraft.json shape, so the client sees one format either way; the
 * response says which feed answered so a silence can be attributed.
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
type Ac = Record<string, unknown>;

/** ADS-B Exchange via RapidAPI. Null when there is no key or the call failed. */
async function fromAdsbx(reg: string): Promise<Ac[] | null> {
  const key = process.env.ADSBX_RAPIDAPI_KEY;
  if (!key) return null;
  try {
    const res = await fetch(
      `https://adsbexchange-com1.p.rapidapi.com/v2/registration/${encodeURIComponent(reg)}/`,
      {
        headers: {
          accept: "application/json",
          "x-rapidapi-key": key,
          "x-rapidapi-host": "adsbexchange-com1.p.rapidapi.com",
        },
        // Every call is metered against the plan. Ten seconds of edge caching
        // matches the client's poll and collapses every viewer of one tail
        // onto a single upstream request.
        next: { revalidate: 10 },
      },
    );
    if (!res.ok) return null;
    const json = (await res.json()) as { ac?: Ac[] };
    return json.ac ?? [];
  } catch {
    return null;
  }
}

export async function GET(_req: Request, ctx: { params: Promise<{ reg: string }> }) {
  const { reg: raw } = await ctx.params;
  // Registrations are letters, digits and hyphens. Anything else is not one,
  // and must not be passed upstream.
  if (!/^[A-Z0-9-]{2,10}$/i.test(raw)) {
    return NextResponse.json({ error: "bad registration" }, { status: 400 });
  }
  const reg = raw.toUpperCase();

  const adsbx = await fromAdsbx(reg);
  if (adsbx) return NextResponse.json({ ac: adsbx, source: "adsbx" });

  try {
    const res = await fetch(`https://api.adsb.lol/v2/reg/${encodeURIComponent(reg)}`, {
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
    return NextResponse.json({ ac: json.ac ?? [], source: "adsblol" });
  } catch {
    return NextResponse.json({ error: "upstream unreachable" }, { status: 502 });
  }
}
