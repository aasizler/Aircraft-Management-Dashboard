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
  { source: "NBAA", url: "https://nbaa.org/feed/" },
];

/*
 * Checked and rejected: AOPA, EAA and AIN serve HTML at every feed URL tried,
 * and General Aviation News answers "RSS2 feeds are currently broken". Three
 * working sources beat six where half never load.
 */

type Item = { title: string; link: string; date: string; source: string; image?: string };
const tag = (block: string, name: string) =>
  new RegExp(`<${name}[^>]*>(?:<!\\[CDATA\\[)?([\\s\\S]*?)(?:\\]\\]>)?</${name}>`).exec(block)?.[1]?.trim() ?? "";

const decode = (v: string) =>
  v.replace(/&#8217;|&rsquo;/g, "\u2019").replace(/&#8216;|&lsquo;/g, "\u2018")
   .replace(/&#8220;|&ldquo;/g, "\u201c").replace(/&#8221;|&rdquo;/g, "\u201d")
   .replace(/&#8211;|&ndash;/g, "\u2013").replace(/&#8212;|&mdash;/g, "\u2014")
   .replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">")
   .replace(/&quot;/g, '"').replace(/&#0?39;|&apos;/g, "'");

/**
 * Neither feed carries an image — no media:content, no enclosure, nothing in
 * content:encoded — but the articles publish og:image, so a picture costs one
 * extra fetch. Only for the cards: a thumbnail per headline would mean a page
 * load each for a sidebar.
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

export async function GET() {
  const ac = new AbortController();
  const t = setTimeout(() => ac.abort(), 8000);
  try {
    // One slow or broken feed must not empty the panel.
    const settled = await Promise.allSettled(FEEDS.map((f) => read(f, ac.signal)));
    const items = settled.flatMap((s) => (s.status === "fulfilled" ? s.value : []));
    items.sort((a, b) => Date.parse(b.date || "") - Date.parse(a.date || ""));
    if (!items.length) return NextResponse.json({ error: "no feeds reachable" }, { status: 502 });

    // Flying's newest story leads and supplies the photograph; everything else
    // follows by date. Ranking by whether a headline names something in the
    // hangar was tried and dropped — with a mixed fleet the keyword list grows
    // until most headlines match and the signal disappears.
    // Pinned: the daily picture, whichever outlet runs one. It is a photograph
    // by definition, so it always earns the image slot.
    const pinnedIdx = items.findIndex((i) => /picture of the day/i.test(i.title));
    const pinned = pinnedIdx >= 0 ? items.splice(pinnedIdx, 1)[0] : null;
    if (pinned) pinned.image = await leadImage(pinned.link, ac.signal);

    // Two picture cards: the newest story, then the newest from a DIFFERENT
    // source, so two publishers lead without either being preferred.
    //
    // Ranking by prominence was tried and dropped. Google News could measure it
    // — clustering its results and counting distinct publishers genuinely
    // worked — but it rate-limits by returning a VALID RSS document with no
    // items rather than an error. A source that refuses silently cannot be
    // told apart from a quiet news day, and this panel would have shown the
    // difference as nothing at all.
    const first = items[0];
    const second = items.find((i) => i.source !== first?.source) ?? items[1];
    const cards = await Promise.all(
      [first, second].filter(Boolean).map(async (i) => ({
        ...i, image: await leadImage(i.link, ac.signal),
      })),
    );

    // Everything else, round-robin by source so an association feed is not
    // buried by magazines that simply publish more often.
    const taken = new Set(cards.map((c) => c.link));
    const queues = new Map<string, Item[]>();
    for (const i of items) {
      if (taken.has(i.link)) continue;
      queues.set(i.source, [...(queues.get(i.source) ?? []), i]);
    }
    const rest: Item[] = [];
    while (rest.length < 5 && [...queues.values()].some((q) => q.length)) {
      for (const q of queues.values()) {
        const n = q.shift();
        if (n) rest.push(n);
        if (rest.length >= 5) break;
      }
    }

    return NextResponse.json({ pinned, cards, items: rest }, {
      headers: { "cache-control": "public, max-age=60, stale-while-revalidate=1800" },
    });
  } catch {
    return NextResponse.json({ error: "unreachable" }, { status: 502 });
  } finally {
    clearTimeout(t);
  }
}
