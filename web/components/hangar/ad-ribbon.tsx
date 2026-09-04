"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Icon } from "@/components/ui/icon";
import {
  fetchDirectives, loadSeen, saveSeen, type Craft, type Directive,
} from "@/lib/directives";

/**
 * Airworthiness Directives affecting the makes in this hangar.
 *
 * Advisory only. Nothing here is attached to an aircraft or recorded against
 * it — an acknowledgement would have to be attributable to a person and live
 * in the database, which is a different feature. This says "this exists, go
 * read it", and remembers per-browser which ones you have already seen so it
 * stops repeating itself.
 */
export function AdRibbon({ fleet }: { fleet: Craft[] }) {
  const [rows, setRows] = useState<Directive[] | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [seen, setSeen] = useState<Set<string>>(() => new Set());
  const [showAll, setShowAll] = useState(false);

  // Keyed on the fleet's makes so it refetches when an aircraft is added, not
  // on every render of the hangar.
  const key = useMemo(
    () => fleet.map((c) => `${c.type ?? ""}|${c.engineType ?? ""}`).sort().join("~"),
    [fleet],
  );

  useEffect(() => { setSeen(loadSeen()); }, []);

  useEffect(() => {
    const ac = new AbortController();
    setRows(null);
    setErr(null);
    fetchDirectives(fleet, ac.signal)
      .then((d) => setRows(d))
      .catch((e) => { if (e.name !== "AbortError") setErr(String(e.message ?? e)); });
    return () => ac.abort();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  const markSeen = useCallback((id: string) => {
    setSeen((prev) => {
      const next = new Set(prev).add(id);
      saveSeen(next);
      return next;
    });
  }, []);

  const unread = (rows ?? []).filter((r) => !seen.has(r.id));
  const shown = showAll ? (rows ?? []) : unread.length ? unread : (rows ?? []).slice(0, 5);

  return (
    <aside className="ad-rail" aria-label="Airworthiness directives">
      <div className="ad-hd">
        <Icon name="shield" size={15} />
        <span className="ad-title">Airworthiness</span>
        {unread.length > 0 && <span className="ad-count">{unread.length}</span>}
      </div>

      {rows === null && !err && <div className="ad-note">Checking the Federal Register…</div>}

      {err && (
        <div className="ad-note warn">
          Couldn&rsquo;t reach the Federal Register. This says nothing about whether
          any directives exist — try again later.
        </div>
      )}

      {rows?.length === 0 && (
        <div className="ad-note">
          No directives found for the makes in your hangar.
        </div>
      )}

      {shown.map((d) => (
        <a
          key={d.id}
          className={`ad-item${seen.has(d.id) ? " seen" : ""}`}
          href={d.url}
          target="_blank"
          rel="noopener noreferrer"
          onClick={() => markSeen(d.id)}
        >
          <div className="ad-item-top">
            <span className="ad-date">{d.date}</span>
            {d.affects.length > 0 && (
              <span className="ad-regs">{d.affects.join(" · ")}</span>
            )}
          </div>
          <div className="ad-item-title">{d.title}</div>
        </a>
      ))}

      {(rows?.length ?? 0) > shown.length && (
        <button className="ad-more" onClick={() => setShowAll(true)}>
          Show all {rows!.length}
        </button>
      )}

      {rows && rows.length > 0 && (
        <div className="ad-foot">
          Directives only. Manufacturer service bulletins are not published
          through any open feed — find them from an aircraft&rsquo;s Documents tab.
        </div>
      )}
    </aside>
  );
}
