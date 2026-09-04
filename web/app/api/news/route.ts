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
/** A story several outlets ran, which is the only prominence signal available. */
type Headline = Item & { pubs: number; outlets: string[] };

const GOOGLE_NEWS =
  "https://news.google.com/rss/search?q=general+aviation&hl=en-US&gl=US&ceid=US:en";

// The query's own words carry no information — every result contains them, so
// leaving them in merged 27 unrelated stories into one cluster.
const QUERY_WORDS = ["general", "aviation", "aircraft", "plane", "planes"];
const STOP = new Set(
  ("the a an of in on at to for and or with from by is are was were as its it this " +
   "that new has have will up all " + QUERY_WORDS.join(" ")).split(" "),
);
const words = (t: string) =>
  new Set(t.toLowerCase().replace(/[^a-z0-9 ]/g, " ").split(/\s+/)
    .filter((w) => w.length > 3 && !STOP.has(w)));
const overlaps = (a: Set<string>, b: Set<string>) =>
  [...a].filter((w) => b.has(w)).length >= 2;

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

/**
 * The day's biggest stories, by how many outlets ran them.
 *
 * RSS carries no popularity signal — no views, no shares — so "top" has to be
 * inferred. Corroboration across the three direct feeds was tried first and
 * produced nothing: they cover different beats and shared no story at all in 30
 * items. Google News aggregates hundreds of outlets, so counting distinct
 * publishers per story does work, and it is a defensible definition of making
 * headlines rather than a guess dressed as a ranking.
 *
 * Google's own links never leave news.google.com, so a headline only gets a
 * thumbnail when it also appears in one of the direct feeds, which supplies a
 * real article URL to read og:image from.
 */
async function headlines(direct: Item[], signal: AbortSignal): Promise<Headline[]> {
  const res = await fetch(GOOGLE_NEWS, { signal, next: { revalidate: 1800 } });
  if (!res.ok) return [];
  const xml = await res.text();

  type G = { title: string; link: string; date: string; outlet: string; toks: Set<string> };
  const rows: G[] = [];
  for (const m of xml.matchAll(/<item>([\s\S]*?)<\/item>/g)) {
    const b = m[1];
    const outlet = /<source[^>]*>([\s\S]*?)<\/source>/.exec(b)?.[1]?.trim() ?? "";
    // Google appends " - Publisher" to every title.
    const title = decode(tag(b, "title")).replace(
      new RegExp(`\\s*-\\s*${outlet.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}$`), "");
    if (!title || !outlet) continue;
    rows.push({ title, link: tag(b, "link"), date: tag(b, "pubDate"), outlet, toks: words(title) });
  }

  const used = new Set<number>();
  const clusters: { lead: G; outlets: Set<string> }[] = [];
  for (let i = 0; i < rows.length; i++) {
    if (used.has(i)) continue;
    used.add(i);
    const outlets = new Set([rows[i].outlet]);
    for (let j = i + 1; j < rows.length; j++) {
      if (used.has(j)) continue;
      if (overlaps(rows[i].toks, rows[j].toks)) { used.add(j); outlets.add(rows[j].outlet); }
    }
    clusters.push({ lead: rows[i], outlets });
  }
  clusters.sort((a, b) => b.outlets.size - a.outlets.size);

  const top = clusters.filter((c) => c.outlets.size >= 2).slice(0, 3);
  return Promise.all(top.map(async (c) => {
    // Prefer a direct-feed version: it gives a real article link and a picture.
    const match = direct.find((d) => overlaps(words(d.title), c.lead.toks));
    const base: Headline = match
      ? { ...match, pubs: c.outlets.size, outlets: [...c.outlets] }
      : { title: c.lead.title, link: c.lead.link, date: c.lead.date,
          source: c.lead.outlet, pubs: c.outlets.size, outlets: [...c.outlets] };
    if (match) base.image = await leadImage(match.link, signal);
    return base;
  }));
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

    let top3 = await headlines(items, ac.signal);

    // Google News rate-limits hard, and it refuses by returning a VALID RSS
    // document with no items rather than an error — a silent zero. Left alone
    // that makes the section vanish with no explanation, which is the same
    // misleading negative as a blocked ADS-B lookup reading as "not flying".
    // When the ranking is unavailable, fall back to the newest story from two
    // different direct feeds, carrying no outlet count because there is no
    // prominence signal to report.
    if (top3.length < 2) {
      const first = items[0];
      const second = items.find((i) => i.source !== first?.source) ?? items[1];
      top3 = await Promise.all(
        [first, second].filter(Boolean).map(async (i) => ({
          ...i, pubs: 0, outlets: [] as string[], image: await leadImage(i.link, ac.signal),
        })),
      );
    }

    // Everything else, round-robin by source so an association feed is not
    // buried by magazines that simply publish more often.
    const taken = new Set(top3.map((h) => h.link));
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

    return NextResponse.json({ pinned, headlines: top3, items: rest }, {
      headers: { "cache-control": "public, max-age=60, stale-while-revalidate=1800" },
    });
  } catch {
    return NextResponse.json({ error: "unreachable" }, { status: 502 });
  } finally {
    clearTimeout(t);
  }
}
