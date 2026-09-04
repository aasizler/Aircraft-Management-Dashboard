"use client";

import { useEffect, useMemo, useState } from "react";
import { Icon } from "@/components/ui/icon";
import { fleetKeywords, type Craft } from "@/lib/directives";

type Item = { title: string; link: string; date: string; source: string; image?: string; hits?: string[] };

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
export function NewsFeed({ fleet }: { fleet: Craft[] }) {
  const [state, setState] = useState<{ items: Item[] | null; err: boolean }>(
    { items: null, err: false },
  );
  // A hotlinked publisher image can 403; drop to text rather than an icon.
  const [imgFailed, setImgFailed] = useState(false);
  const keywords = useMemo(() => fleetKeywords(fleet), [fleet]);

  // A headline naming one of your makes is worth more than a newer one that
  // doesn't, so relevance outranks recency — but only for the handful that
  // match, and the lead card keeps whatever ends up first.
  const ranked = useMemo(
    () => (state.items ?? []).map((n) => ({ n, hits: n.hits ?? [] })),
    [state.items],
  );

  const lead = ranked[0];
  // Four, not seven. Eight equally weighted rows is a wall, and the rail has a
  // second section under it that deserves the room.
  const rest = ranked.slice(1, 5);

  useEffect(() => {
    const ac = new AbortController();
    // The server ranks, so it knows which story leads and can fetch that one's
    // picture. Sorting here again would put the image on the wrong item.
    const q = keywords.length ? `?fleet=${encodeURIComponent(keywords.join(","))}` : "";
    fetch(`/api/news${q}`, { signal: ac.signal })
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(String(r.status)))))
      .then((j: { items?: Item[] }) => setState({ items: j.items ?? [], err: false }))
      .catch((e) => { if (e.name !== "AbortError") setState({ items: [], err: true }); });
    return () => ac.abort();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [keywords.join(",")]);

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
      {lead && (
        <a className="news-lead" href={lead.n.link} target="_blank" rel="noopener noreferrer">
          {lead.n.image && !imgFailed && (
            /* Remote publisher images on hosts that change with the feed list.
               next/image would need each one allow-listed in next.config and
               would bill optimisation for a sidebar thumbnail. */
            // eslint-disable-next-line @next/next/no-img-element
            <img
              className="news-lead-img"
              src={lead.n.image}
              alt=""
              loading="lazy"
              onError={() => setImgFailed(true)}
            />
          )}
          <div className="news-lead-body">
            <div className="news-meta">
              <span className="news-src">{lead.n.source}</span>
              {lead.hits.length > 0 && <span className="news-hit">Your fleet</span>}
              <span className="news-age">{ago(lead.n.date)}</span>
            </div>
            <div className="news-lead-title">{lead.n.title}</div>
          </div>
        </a>
      )}

      {rest.map(({ n, hits }) => (
        <a key={n.link} className={`news-item${hits.length ? " hit" : ""}`}
           href={n.link} target="_blank" rel="noopener noreferrer">
          <div className="news-meta">
            <span className="news-src">{n.source}</span>
            {hits.length > 0 && <span className="news-hit" title={hits.join(" · ")}>Your fleet</span>}
            <span className="news-age">{ago(n.date)}</span>
          </div>
          <div className="news-title">{n.title}</div>
        </a>
      ))}
    </div>
  );
}
