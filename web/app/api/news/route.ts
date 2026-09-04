import { NextResponse } from "next/server";

/**
 * General-aviation headlines for the hangar rail.
 *
 * Proxied for the usual reason: neither feed sends an access-control header, so
 * the browser cannot read them directly. Parsed here too, so the client gets a
 * few hundred bytes of JSON rather than two RSS documents.
 *
 * AOPA is absent because it publishes no public feed I could find — every
 * candidate URL returned HTML or a 404. Better two working sources than three
 * with one that silently never loads.
 */
const FEEDS = [
  { source: "Flying", url: "https://www.flyingmag.com/feed/" },
  { source: "AVweb", url: "https://www.avweb.com/feed/" },
];

type Item = { title: string; link: string; date: string; source: string; image?: string; hits?: string[] };

/**
 * Neither feed carries an image — no media:content, no enclosure, nothing in
 * content:encoded — but both articles publish og:image, so the lead story's
 * picture costs one extra fetch. Only the lead: a thumbnail for every headline
 * would mean ten page loads for a sidebar.
 */
async function leadImage(url: string, signal: AbortSignal): Promise<string | undefined> {
  try {
    const res = await fetch(url, { signal, next: { revalidate: 1800 } });
    if (!res.ok) return undefined;
    const html = (await res.text()).slice(0, 60_000); // og tags live in <head>
    const m =
      /<meta[^>]+property=["']og:image["'][^>]+content=["']([^"']+)/i.exec(html) ??
      /<meta[^>]+name=["']twitter:image["'][^>]+content=["']([^"']+)/i.exec(html);
    return m?.[1]?.startsWith("http") ? m[1] : undefined;
  } catch {
    return undefined;
  }
}

const tag = (block: string, name: string) =>
  new RegExp(`<${name}[^>]*>(?:<!\\[CDATA\\[)?([\\s\\S]*?)(?:\\]\\]>)?</${name}>`).exec(block)?.[1]?.trim() ?? "";

const decode = (v: string) =>
  v.replace(/&#8217;|&rsquo;/g, "’").replace(/&#8216;|&lsquo;/g, "‘")
   .replace(/&#8220;|&ldquo;/g, "“").replace(/&#8221;|&rdquo;/g, "”")
   .replace(/&#8211;|&ndash;/g, "–").replace(/&#8212;|&mdash;/g, "—")
   .replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">")
   .replace(/&quot;/g, '"').replace(/&#0?39;|&apos;/g, "'");

async function read(feed: (typeof FEEDS)[number], signal: AbortSignal): Promise<Item[]> {
  const res = await fetch(feed.url, { signal, next: { revalidate: 1800 } });
  if (!res.ok) return [];
  const xml = await res.text();
  const out: Item[] = [];
  for (const m of xml.matchAll(/<item[^>]*>([\s\S]*?)<\/item>/g)) {
    const b = m[1];
    const title = decode(tag(b, "title"));
    const link = tag(b, "link");
    const date = tag(b, "pubDate");
    if (title && link) out.push({ title, link, date, source: feed.source });
    if (out.length >= 10) break;
  }
  return out;
}

export async function GET(req: Request) {
  const ac = new AbortController();
  const t = setTimeout(() => ac.abort(), 8000);
  try {
    // One slow or broken feed must not empty the panel.
    const settled = await Promise.allSettled(FEEDS.map((f) => read(f, ac.signal)));
    const items = settled.flatMap((s) => (s.status === "fulfilled" ? s.value : []));
    items.sort((a, b) => Date.parse(b.date || "") - Date.parse(a.date || ""));
    if (!items.length) return NextResponse.json({ error: "no feeds reachable" }, { status: 502 });

    // Ranking happens HERE, not in the browser, because the lead's picture is
    // fetched by document and the two must agree on which document leads. When
    // the client reordered afterwards, the image stayed on the story it had
    // displaced and the new lead rendered bare.
    const keywords = (new URL(req.url).searchParams.get("fleet") ?? "")
      .split(",").map((k) => k.trim()).filter((k) => k.length >= 4);
    for (const it of items) {
      it.hits = keywords.filter((k) =>
        new RegExp(`\\b${k.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`, "i").test(it.title),
      );
    }
    // Relevance first, then recency within each group.
    items.sort((a, b) => (b.hits!.length ? 1 : 0) - (a.hits!.length ? 1 : 0));

    const top = items.slice(0, 8);
    // A missing picture is not a failure — the card falls back to text.
    top[0].image = await leadImage(top[0].link, ac.signal);

    return NextResponse.json({ items: top }, {
      headers: { "cache-control": "public, max-age=900" },
    });
  } catch {
    return NextResponse.json({ error: "unreachable" }, { status: 502 });
  } finally {
    clearTimeout(t);
  }
}
