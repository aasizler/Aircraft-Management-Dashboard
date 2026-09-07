import { NextResponse } from "next/server";

/**
 * Server-side proxy for the live feed, keyed on the registration.
 *
 * Cost first: the free feed (adsb.lol) is asked on every call and answers
 * whenever it has a fresh position. ADS-B Exchange — metered per request —
 * is asked only when the caller sends ?paid=1 AND the free feed is stale or
 * silent. So an aircraft the volunteer network hears costs nothing, and the
 * paid feed is spent exactly where its denser receivers are the only ones
 * listening (an RV-12 on final into Venice at 125 ft was on ADS-B Exchange
 * and on neither adsb.lol nor adsb.fi). Both answer in readsb's shape; the
 * response names the feed that answered so a silence can be attributed.
 *
 * The browser cannot call api.adsb.lol directly: it answers 200 with valid
 * JSON but sends no Access-Control-Allow-Origin header on ANY response, so
 * every lookup failed in the browser and the banner reported "not
 * broadcasting" for what was actually a blocked request.
 *
 * Lookups are by registration. The N-number → ICAO hex conversion this once
 * did was wrong for every one of 1,682 registrations checked, and the feeds
 * index by registration directly, so there is nothing to convert.
 */

type Ac = Record<string, unknown> & { lat?: number; seen_pos?: number };
/** A feed answer: the aircraft list and the feed's own snapshot time (ms). */
type Feed = { ac: Ac[]; now: number };

const UA = "AeroTrack/1.0 (+https://aerotrack-next.vercel.app)";
/** A free-feed position older than this is treated as silence. */
const FRESH_S = 20;

/** adsb.lol. Null only when unreachable; an empty list is a real answer. */
async function fromFree(reg: string): Promise<Feed | null> {
  try {
    const res = await fetch(`https://api.adsb.lol/v2/reg/${encodeURIComponent(reg)}`, {
      // adsb.lol 403s the default Node fetch User-Agent ("node") and an empty
      // one; it wants callers to identify themselves.
      headers: { accept: "application/json", "user-agent": UA },
      // The feed updates every second. Two seconds of edge caching lets a
      // live map poll at that rate while every viewer of one tail shares a
      // single upstream call.
      next: { revalidate: 2 },
    });
    if (!res.ok) return null;
    const json = (await res.json()) as { ac?: Ac[]; now?: number };
    return { ac: json.ac ?? [], now: json.now ?? Date.now() };
  } catch {
    return null;
  }
}

/** ADS-B Exchange via RapidAPI. Null when there is no key or the call failed. */
async function fromAdsbx(reg: string): Promise<Feed | null> {
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
        // Every call is metered. Five seconds matches the fastest cadence a
        // client asks for on this feed (a live map with the free feed blind)
        // and collapses every viewer of one tail onto one upstream request.
        next: { revalidate: 5 },
      },
    );
    if (!res.ok) return null;
    const json = (await res.json()) as { ac?: Ac[]; now?: number };
    return { ac: json.ac ?? [], now: json.now ?? Date.now() };
  } catch {
    return null;
  }
}

// Age is measured from the feed's snapshot, not from now: a cached answer
// is a few seconds older than it says, and the client corrects for that.
const fresh = (f: Feed) =>
  f.ac.some((a) => typeof a.lat === "number" &&
    (a.seen_pos ?? Infinity) + (Date.now() - f.now) / 1000 <= FRESH_S);

export async function GET(req: Request, ctx: { params: Promise<{ reg: string }> }) {
  const { reg: raw } = await ctx.params;
  // Registrations are letters, digits and hyphens. Anything else is not one,
  // and must not be passed upstream.
  if (!/^[A-Z0-9-]{2,10}$/i.test(raw)) {
    return NextResponse.json({ error: "bad registration" }, { status: 400 });
  }
  const reg = raw.toUpperCase();
  const paid = new URL(req.url).searchParams.get("paid") === "1";

  const free = await fromFree(reg);
  if (free && fresh(free)) return NextResponse.json({ ...free, source: "adsblol" });

  if (paid) {
    const x = await fromAdsbx(reg);
    if (x) return NextResponse.json({ ...x, source: "adsbx" });
  }

  if (free) return NextResponse.json({ ...free, source: "adsblol" });
  return NextResponse.json({ error: "upstream unreachable" }, { status: 502 });
}
