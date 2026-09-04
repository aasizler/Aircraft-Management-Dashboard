"use client";

import { useEffect, useState } from "react";
import { Icon } from "@/components/ui/icon";

type Item = { title: string; link: string; date: string; source: string };

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

      {state.items?.map((n) => (
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
