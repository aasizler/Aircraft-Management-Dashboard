import { NextResponse } from "next/server";

/**
 * Service bulletins cited by one airworthiness directive.
 *
 * This is a proxy for the same reason /api/adsb is: the Federal Register's
 * /api/ path sends `access-control-allow-origin: *`, but the full-text path it
 * points at sends no CORS header at all. Fetched from the browser it fails
 * silently and the scan reports "no bulletins cited", which is a false negative
 * dressed as an answer.
 *
 * The regex runs here rather than in the browser, so the ~26KB document never
 * crosses the wire twice — the client gets back a handful of strings.
 */
const SB_PATTERN =
  /(?:mandatory\s+)?service\s+(?:bulletin|information\s+letter|instruction)s?\s*(?:no\.?\s*)?([A-Z0-9][A-Z0-9\-.]{2,24})/gi;

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ doc: string }> },
) {
  const { doc } = await params;
  if (!/^[0-9]{4}-[0-9]{3,6}$/.test(doc)) {
    return NextResponse.json({ error: "bad document number" }, { status: 400 });
  }

  try {
    // The text lives under a dated path, so ask the API where before fetching.
    const metaRes = await fetch(
      `https://www.federalregister.gov/api/v1/documents/${doc}.json?fields[]=raw_text_url`,
      { next: { revalidate: 86_400 } },
    );
    if (!metaRes.ok) return NextResponse.json({ error: "lookup failed" }, { status: 502 });
    const meta = (await metaRes.json()) as { raw_text_url?: string | null };
    if (!meta.raw_text_url) return NextResponse.json({ refs: [] });

    const textRes = await fetch(meta.raw_text_url, { next: { revalidate: 86_400 } });
    if (!textRes.ok) return NextResponse.json({ error: "text failed" }, { status: 502 });
    const text = await textRes.text();

    const found = new Set<string>();
    for (const m of text.matchAll(SB_PATTERN)) {
      // A reference broken across a line arrives truncated ("SB2X-76-"), so
      // trailing punctuation goes and bare prefixes are dropped below.
      const ref = m[1].replace(/[.,;)\-]+$/, "").toUpperCase();
      if (ref.length >= 3 && /\d/.test(ref)) found.add(ref);
    }
    const all = [...found];
    const refs = all.filter((r) => !all.some((o) => o !== r && o.startsWith(r))).sort();

    // Directives don't change once published; a day of caching is generous.
    return NextResponse.json({ refs }, {
      headers: { "cache-control": "public, max-age=86400" },
    });
  } catch {
    return NextResponse.json({ error: "unreachable" }, { status: 502 });
  }
}
