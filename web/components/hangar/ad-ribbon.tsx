"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Icon } from "@/components/ui/icon";
import { NewsFeed } from "./news-feed";
import {
  coverageGaps, engineGaps, fetchDirectives, loadSeen, saveSeen, type Craft, type Directive,
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
export type FleetSummary = {
  count: number;
  grounded: number;
  due: number;
  /** The single most pressing item across the hangar, already phrased. */
  next: { reg: string; text: string; level: "grounded" | "due" | "ok" } | null;
};

/**
 * The rail opens with this hangar's own state, so it earns its place before
 * showing anything from outside it. Everything here is already on the page —
 * it is the roll-ups from the fleet headers, said once.
 */
function FleetLine({ summary }: { summary?: FleetSummary }) {
  if (!summary) return null;
  const { count, grounded, due, next } = summary;
  return (
    <div className="fleet-line">
      <div className="fleet-line-top">
        <span className="fleet-count">{count}</span>
        <span className="fleet-word">{count === 1 ? "aircraft" : "aircraft"}</span>
        {grounded > 0 && <span className="fleet-pill grounded">{grounded} grounded</span>}
        {due > 0 && <span className="fleet-pill due">{due} due soon</span>}
        {!grounded && !due && <span className="fleet-pill ok">all clear</span>}
      </div>
      {next && (
        <div className={`fleet-next ${next.level}`}>
          <b>{next.reg}</b> {next.text}
        </div>
      )}
    </div>
  );
}

export function AdRibbon({ fleet, summary }: { fleet: Craft[]; summary?: FleetSummary }) {
  // Read at initialisation, not in an effect: an effect would render once with
  // everything unread and then again with the truth, flashing the count.
  const [seen, setSeen] = useState<Set<string>>(() =>
    typeof window === "undefined" ? new Set() : loadSeen(),
  );
  const [showAll, setShowAll] = useState(false);

  // One state object carrying the key it belongs to, so the effect never has
  // to synchronously reset anything before fetching — a result for a stale key
  // simply reads as "still loading".
  const [data, setData] = useState<{ key: string; rows: Directive[]; err: string | null }>(
    { key: "", rows: [], err: null },
  );

  // Keyed on the fleet's makes so it refetches when an aircraft is added, not
  // on every render of the hangar.
  const key = useMemo(
    () => fleet.map((c) => `${c.type ?? ""}|${c.engineType ?? ""}`).sort().join("~"),
    [fleet],
  );

  useEffect(() => {
    const ac = new AbortController();
    fetchDirectives(fleet, ac.signal)
      .then((rows) => setData({ key, rows, err: null }))
      .catch((e) => {
        if (e.name !== "AbortError") setData({ key, rows: [], err: String(e.message ?? e) });
      });
    return () => ac.abort();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  const ready = data.key === key;
  const rows = ready ? data.rows : null;
  const err = ready ? data.err : null;

  const markSeen = useCallback((id: string) => {
    setSeen((prev) => {
      const next = new Set(prev).add(id);
      saveSeen(next);
      return next;
    });
  }, []);

  // Relevant means: names a model you operate, or names none at all. The rest
  // are published for your manufacturers but for other types.
  const gaps = useMemo(() => coverageGaps(fleet), [fleet]);
  const engGaps = useMemo(() => engineGaps(fleet), [fleet]);
  // Three tiers, and only the first is asserted. Four rows all reading "check
  // applicability" is noise pretending to be a finding — if nothing definitely
  // applies, say so and leave the uncertain ones to the expander.
  const matched = (rows ?? []).filter((r) => r.affects.length);
  const unsure = (rows ?? []).filter((r) => !r.affects.length && !r.other);
  const other = (rows ?? []).filter((r) => r.other);
  const unread = matched.filter((r) => !seen.has(r.id));
  const shown = showAll
    ? [...matched, ...unsure, ...other]
    : unread.length
      ? unread
      : matched.slice(0, 5);

  return (
    <aside className="ad-rail" aria-label="Hangar rail">
      <FleetLine summary={summary} />

      <NewsFeed fleet={fleet} />

      <div className="rail-block">
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
        <div className="ad-note">No directives found for the makes in your hangar.</div>
      )}
      {rows && rows.length > 0 && matched.length === 0 && !showAll && (
        <div className="ad-clear">
          <Icon name="check" size={14} />
          Nothing published in the last 24 months names a model you operate.
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
            <span className="ad-date">
              {d.date}
              {d.proposed && <span className="ad-proposed">Proposed</span>}
            </span>
            {/* A registration is shown only where the directive names a model
                you actually operate. Where it names none, or names a variant of
                one, it says so instead of asserting. */}
            {d.affects.length > 0 ? (
              <span className="ad-regs">{d.affects.join(" · ")}</span>
            ) : (
              <span className="ad-regs unsure" title="This directive names no model, or a variant of one you operate — check applicability">
                check applicability
              </span>
            )}
          </div>
          <div className="ad-item-title">{d.title}</div>
        </a>
      ))}

      {!showAll && (rows?.length ?? 0) > shown.length && (
        <button className="ad-more" onClick={() => setShowAll(true)}>
          {unsure.length > 0
            ? `Show ${unsure.length} to check · ${other.length} other types`
            : `Show all ${rows!.length}`}
        </button>
      )}

      {/* An aircraft nothing is being checked for must say so. An empty list
          otherwise reads as "nothing is wrong". */}
      {ready && gaps.map((g) => (
        <div key={g.regs.join()} className="ad-note">
          <b>{g.regs.join(" · ")}</b>{" — "}
          {g.why.kind === "amateur"
            ? `${g.why.maker} types are amateur-built, so the FAA issues them no directives.`
            : g.why.kind === "no-source"
              ? `no directive source is set up for ${g.why.maker}.`
              : "its type wasn't picked from the list, so no make could be resolved and nothing is being checked. Re-pick it in Aircraft Settings."}
        </div>
      ))}

      {/* Separate from the airframe gaps above: these aircraft ARE being
          checked, just not for their engines, which is the more misleading of
          the two because the list looks complete. */}
      {ready && engGaps.map(({ craft, why }) => (
        <div key={craft.reg} className="ad-note">
          {craft.id ? (
            <a className="ad-gap-link" href={`/aircraft/${craft.id}`}>{craft.reg}</a>
          ) : (
            <b>{craft.reg}</b>
          )}
          {why === "missing"
            ? " — airframe only. No engine is set, so engine directives aren't being checked."
            : " — no directive source is set up for this engine's maker."}
        </div>
      ))}

      </div>
    </aside>
  );
}
