"use client";

import { useEffect, useMemo, useState } from "react";
import { Icon } from "@/components/ui/icon";
import { coverageOf, fetchDirectives, type Directive } from "@/lib/directives";

/**
 * Airworthiness directives for this airframe and engine, from the Federal
 * Register's API.
 *
 * Service bulletins are deliberately absent. There is no open feed for them —
 * each manufacturer publishes to its own site, most behind a customer login —
 * and the two partial workarounds both failed the same test: a panel that
 * cannot distinguish "no bulletins exist" from "no bulletins reachable" tells
 * an owner their aircraft is clear when nobody checked.
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
  const cover = coverageOf({ reg, type, engineType });

  return (
    <div style={{ marginTop: 26 }}>
      <div className="section-label" style={{ marginBottom: 4 }}>
        Airworthiness directives
      </div>
      <div style={{ fontSize: 11, color: "var(--muted)", marginBottom: 12 }}>
        Published by the FAA for this airframe and engine, last 24 months.
      </div>

      <div className="pub-card">
        <div className="pub-hd"><Icon name="shield" size={14} />Federal Register</div>

        {!ready && <div className="pub-note">Checking…</div>}

        {ready && data.err && (
          <div className="pub-note warn">
            Couldn&rsquo;t reach the Federal Register — this says nothing about
            whether any directives exist.
          </div>
        )}

        {/* Why the list is empty matters more than the fact that it is. */}
        {ready && cover.kind !== "ok" && (
          <div className="pub-note warn">
            {cover.kind === "amateur"
              ? `${cover.maker} types are amateur-built — the FAA issues them no directives, so an empty list here is the correct answer.`
              : cover.kind === "no-source"
                ? `No directive source is set up for ${cover.maker}, so none are being checked.`
                : "This aircraft's type wasn't picked from the list, so no manufacturer could be resolved and no directives are being checked."}
          </div>
        )}
        {cover.kind === "unrecognised" && ready && (
          <div className="pub-prompt">
            <Icon name="alert" size={14} />
            <span>Pick {reg}&rsquo;s type from the catalogue to switch this on.</span>
            <button className="btn sm"
                    onClick={() => window.dispatchEvent(new Event("aerotrack:aircraft-settings"))}>
              Set type
            </button>
          </div>
        )}
        {rows?.length === 0 && cover.kind === "ok" && (
          <div className="pub-note">None in the last 24 months for this airframe.</div>
        )}

        {rows?.map((d) => (
          <a key={d.id} className="pub-ad" href={d.url} target="_blank" rel="noopener noreferrer">
            <span className="pub-date">
              {d.date}
              {d.proposed && <span className="pub-proposed">Proposed</span>}
              {d.affects.length === 0 && (
                <span className="pub-unsure">check applicability</span>
              )}
            </span>
            <span className="pub-ad-title">{d.title}</span>
          </a>
        ))}

        {/* Airframe directives list either way; this says what is still missing,
            which a full airframe list does not reveal. */}
        {ready && !engineType && (
          <div className="pub-prompt">
            <Icon name="alert" size={14} />
            <span>
              Airframe only — no engine is set for {reg}, so engine directives
              aren&rsquo;t being checked.
            </span>
            <button
              className="btn sm"
              onClick={() => window.dispatchEvent(new Event("aerotrack:aircraft-settings"))}
            >
              Set engine
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
