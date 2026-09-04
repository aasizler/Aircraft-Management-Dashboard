"use client";

import { useEffect, useState } from "react";
import { Icon } from "@/components/ui/icon";

type Item = { title: string; link: string; date: string; source: string; image?: string };
type Headline = Item & { pubs: number; outlets: string[] };
type Payload = { pinned: Item | null; headlines: Headline[]; items: Item[] };

/** Relative age — a headline's value is mostly how new it is. */
function ago(iso: string) {
  const t = Date.parse(iso);
  if (!t) return "";
  const h = Math.round((Date.now() - t) / 3_600_000);
  if (h < 1) return "just now";
  if (h < 24) return `${h}h ago`;
  const d = Math.round(h / 24);
  return d === 1 ? "yesterday" : `${d}d ago`;
}

/** General-aviation headlines, via /api/news — the feeds send no CORS header. */
export function NewsFeed() {
  const [state, setState] = useState<{ data: Payload | null; err: boolean }>(
    { data: null, err: false },
  );
  // A hotlinked publisher image can 403; drop that card to text, not an icon.
  const [failed, setFailed] = useState<Record<string, boolean>>({});

  // A headline naming one of your makes is worth more than a newer one that
  // doesn't, so relevance outranks recency — but only for the handful that
  // match, and the lead card keeps whatever ends up first.
  const pinned = state.data?.pinned ?? null;
  const heads = state.data?.headlines ?? [];
  // Four, not seven. Eight equally weighted rows is a wall, and the rail has a
  // second section under it that deserves the room.
  const rest = state.data?.items ?? [];

  useEffect(() => {
    const ac = new AbortController();
    fetch("/api/news", { signal: ac.signal })
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(String(r.status)))))
      .then((j: Payload) => setState({ data: j, err: false }))
      .catch((e) => { if (e.name !== "AbortError") setState({ data: null, err: true }); });
    return () => ac.abort();
  }, []);

  return (
    <div className="rail-block">
      <div className="ad-hd">
        <Icon name="inbox" size={15} />
        <span className="ad-title">Industry</span>
      </div>

      {state.data === null && !state.err && <div className="ad-note">Loading headlines…</div>}
      {state.err && <div className="ad-note">Headlines unavailable right now.</div>}

      {/* Lead story as a front page: picture, then the headline over it. The
          rest stay as text rows — ten thumbnails in a sidebar is a gallery, not
          a news panel. */}
      {pinned && (
        <a className="news-lead" href={pinned.link} target="_blank" rel="noopener noreferrer">
          {pinned.image && !failed[pinned.link] && (
            /* Remote publisher images on hosts that change with the feed list.
               next/image would need each allow-listed in next.config and would
               bill optimisation for a sidebar thumbnail. */
            // eslint-disable-next-line @next/next/no-img-element
            <img className="news-lead-img" src={pinned.image} alt="" loading="lazy"
                 onError={() => setFailed((f) => ({ ...f, [pinned.link]: true }))} />
          )}
          <div className="news-lead-body">
            <div className="news-meta">
              <span className="news-src">{pinned.source}</span>
              <span className="news-age">{ago(pinned.date)}</span>
            </div>
            <div className="news-lead-title">{pinned.title}</div>
          </div>
        </a>
      )}

      {/* The day's biggest stories, measured by how many outlets ran each. A
          thumbnail only appears where the story also reached a direct feed,
          because Google's own links never leave news.google.com. */}
      {heads.length > 0 && (
        <div className="news-sec">{heads[0].pubs > 0 ? "Making headlines" : "Latest"}</div>
      )}
      {heads.map((h) => (
        <a key={h.link} className="news-head" href={h.link} target="_blank" rel="noopener noreferrer">
          {h.image && !failed[h.link] && (
            // eslint-disable-next-line @next/next/no-img-element
            <img className="news-thumb" src={h.image} alt="" loading="lazy"
                 onError={() => setFailed((f) => ({ ...f, [h.link]: true }))} />
          )}
          <div className="news-head-body">
            <div className="news-meta">
              <span className="news-src">{h.source}</span>
              {h.pubs > 0 ? (
                <span className="news-pubs" title={h.outlets.slice(0, 6).join(" · ")}>
                  {h.pubs} outlets
                </span>
              ) : (
                <span className="news-age">{ago(h.date)}</span>
              )}
            </div>
            <div className="news-title">{h.title}</div>
          </div>
        </a>
      ))}

      {rest.length > 0 && <div className="news-sec">More</div>}
      {rest.map((n) => (
        <a key={n.link} className="news-item" href={n.link} target="_blank" rel="noopener noreferrer">
          <div className="news-meta">
            <span className="news-src">{n.source}</span>
            <span className="news-age">{ago(n.date)}</span>
          </div>
          <div className="news-title">{n.title}</div>
        </a>
      ))}
    </div>
  );
}
