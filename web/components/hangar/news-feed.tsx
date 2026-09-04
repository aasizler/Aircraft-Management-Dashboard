"use client";

import { useEffect, useState } from "react";
import { Icon } from "@/components/ui/icon";

type Item = { title: string; link: string; date: string; source: string; image?: string };

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
  const [state, setState] = useState<{ items: Item[] | null; err: boolean }>(
    { items: null, err: false },
  );
  // A hotlinked publisher image can 403; drop that card to text, not an icon.
  const [failed, setFailed] = useState<Record<string, boolean>>({});

  // A headline naming one of your makes is worth more than a newer one that
  // doesn't, so relevance outranks recency — but only for the handful that
  // match, and the lead card keeps whatever ends up first.
  const items = state.items ?? [];
  // Whichever of the top two carry a picture get the card treatment; the rest
  // are rows. No publisher is favoured — see the ordering note in /api/news.
  const heroes = items.slice(0, 2);
  // Four, not seven. Eight equally weighted rows is a wall, and the rail has a
  // second section under it that deserves the room.
  const rest = items.slice(2, 6);

  useEffect(() => {
    const ac = new AbortController();
    fetch("/api/news", { signal: ac.signal })
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(String(r.status)))))
      .then((j: { items?: Item[] }) => setState({ items: j.items ?? [], err: false }))
      .catch((e) => { if (e.name !== "AbortError") setState({ items: [], err: true }); });
    return () => ac.abort();
  }, []);

  return (
    <div className="rail-block">
      <div className="ad-hd">
        <Icon name="inbox" size={15} />
        <span className="ad-title">Industry</span>
      </div>

      {state.items === null && !state.err && <div className="ad-note">Loading headlines…</div>}
      {state.err && <div className="ad-note">Headlines unavailable right now.</div>}

      {/* Lead story as a front page: picture, then the headline over it. The
          rest stay as text rows — ten thumbnails in a sidebar is a gallery, not
          a news panel. */}
      {heroes.map((n) => (
        <a key={n.link} className="news-lead" href={n.link} target="_blank" rel="noopener noreferrer">
          {n.image && !failed[n.link] && (
            /* Remote publisher images on hosts that change with the feed list.
               next/image would need each one allow-listed in next.config and
               would bill optimisation for a sidebar thumbnail. */
            // eslint-disable-next-line @next/next/no-img-element
            <img
              className="news-lead-img"
              src={n.image}
              alt=""
              loading="lazy"
              onError={() => setFailed((f) => ({ ...f, [n.link]: true }))}
            />
          )}
          <div className="news-lead-body">
            <div className="news-meta">
              <span className="news-src">{n.source}</span>
              <span className="news-age">{ago(n.date)}</span>
            </div>
            <div className="news-lead-title">{n.title}</div>
          </div>
        </a>
      ))}

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
