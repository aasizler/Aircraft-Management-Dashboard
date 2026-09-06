"use client";

import { useEffect, useMemo, useState } from "react";
import { coverageOf, fetchDirectives, type Coverage, type Directive } from "./directives";

export type DirectiveFeed = {
  /** Null until the first fetch for this airframe returns. */
  rows: Directive[] | null;
  /** Set when the Federal Register could not be reached. Never means "none". */
  err: string | null;
  /** Whether this make is checkable at all — see coverageOf. */
  cover: Coverage;
};

/**
 * Directives for one aircraft, keyed on the make and engine rather than the
 * registration, so two aeroplanes of the same type do not fetch twice and a
 * rename does not refetch.
 *
 * Extracted so the Documents tab and the dashboard ribbon read the same result.
 * They must agree: a ribbon that says a model is clear while the tab below
 * lists three directives is worse than either alone.
 */
export function useDirectives(
  reg: string,
  type: string | null,
  engineType?: string | null,
): DirectiveFeed {
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
    // craft is rebuilt whenever key's inputs change; keying on the make is the point.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  const ready = data.key === key;
  return {
    rows: ready ? data.rows : null,
    err: ready ? data.err : null,
    cover: coverageOf({ reg, type, engineType }),
  };
}
