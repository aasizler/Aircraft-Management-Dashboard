"use client";

import { useEffect, useMemo, useState } from "react";
import { Icon } from "@/components/ui/icon";
import { fetchDirectives, publishersFor, type Directive } from "@/lib/directives";

/**
 * Where to look for what the FAA and the manufacturers have published about
 * this airframe and engine.
 *
 * Two halves, because the two sources are not alike. Directives come from the
 * Federal Register's API and are listed here directly. Service bulletins have
 * no open feed of any kind — each manufacturer publishes to its own site, most
 * behind a customer login — so this links out rather than pretending to index
 * them.
 */
export function Publications({
  reg, type, engineType,
}: { reg: string; type: string | null; engineType?: string | null }) {
  const craft = useMemo(() => [{ reg, type, engineType }], [reg, type, engineType]);
  const key = `${type ?? ""}|${engineType ?? ""}`;
  const [data, setData] = useState<{ key: string; rows: Directive[]; err: string | null }>(
    { key: "", rows: [], err: null },
  );

  useEffect(() => {
    const ac = new AbortController();
    fetchDirectives(craft, ac.signal)
      .then((rows) => setData({ key, rows, err: null }))
      .catch((e) => {
        if (e.name !== "AbortError") setData({ key, rows: [], err: String(e.message ?? e) });
      });
    return () => ac.abort();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  const ready = data.key === key;
  const rows = ready ? data.rows : null;
  const publishers = publishersFor(type, engineType);

  return (
    <div style={{ marginTop: 26 }}>
      <div className="section-label" style={{ marginBottom: 4 }}>Publications</div>
      <div style={{ fontSize: 11, color: "var(--muted)", marginBottom: 12 }}>
        Airworthiness directives for this airframe and engine, and where its
        manufacturers publish service documents.
      </div>

      <div className="pub-cols">
        <div className="pub-card">
          <div className="pub-hd"><Icon name="shield" size={14} />Airworthiness directives</div>
          {rows === null && !ready && <div className="pub-note">Checking the Federal Register…</div>}
          {ready && data.err && (
            <div className="pub-note warn">
              Couldn&rsquo;t reach the Federal Register — this says nothing about
              whether any directives exist.
            </div>
          )}
          {rows?.length === 0 && (
            <div className="pub-note">
              None in the last 24 months for this make.
              {!engineType && " No engine is recorded, so engine directives aren't being checked."}
            </div>
          )}
          {rows?.slice(0, 8).map((d) => (
            <a key={d.id} className="pub-ad" href={d.url} target="_blank" rel="noopener noreferrer">
              <span className="pub-date">{d.date}</span>
              <span className="pub-ad-title">{d.title}</span>
            </a>
          ))}
          {(rows?.length ?? 0) > 8 && (
            <div className="pub-note">+ {rows!.length - 8} more in the hangar rail.</div>
          )}
        </div>

        <div className="pub-card">
          <div className="pub-hd"><Icon name="file" size={14} />Service bulletins</div>
          {/* Deliberately links to each publisher's front door rather than a
              deep path. Manufacturer document URLs move, and several return 404
              to anything that isn't a browser — a link that lands somewhere real
              beats a precise one that rots. */}
          <div className="pub-note">
            No open feed exists for these. Each manufacturer publishes its own,
            and most sit behind a customer login.
          </div>
          {publishers.map((p) => (
            <a key={p.url} className="pub-link" href={p.url} target="_blank" rel="noopener noreferrer">
              <span className="pub-link-name">{p.name}</span>
              <span className="pub-link-role">{p.role}</span>
            </a>
          ))}
        </div>
      </div>
    </div>
  );
}
