import { useEffect, useState } from "react";
import { loadAirportDb } from "./airports";
import { nearestAirport, type LiveState, type LiveStatus } from "./adsb";

export type Where = {
  /** What to show: a field code, "Airborne", or the home base. */
  label: string;
  /** True when this is where the aeroplane is NOW, rather than where it lives. */
  live: boolean;
  title: string;
};

/**
 * Where the aeroplane is, as opposed to where it is based.
 *
 * The hero used to print the home airport with a status dot beside it, which
 * claimed a live position it never had — the field on file is a stored fact and
 * stays true whether the aeroplane is there, in the air, or three states away.
 *
 * Airborne is not an airport, so it says so rather than naming one. On the
 * ground with a position, the nearest field is genuinely where it is. The
 * airport database is several megabytes, so it is only fetched once there is a
 * position to resolve — a detail page with no ADS-B never pays for it, and the
 * home base shows until the lookup returns.
 */
export function useWhere(
  status: LiveStatus,
  state: LiveState | null,
  homeBase: string | null,
): Where | null {
  const [field, setField] = useState<string | null>(null);
  const lat = state?.lat ?? null;
  const lon = state?.lon ?? null;
  const onGround = status === "ground" && lat != null && lon != null;

  useEffect(() => {
    if (!onGround || lat == null || lon == null) { setField(null); return; }
    let alive = true;
    void (async () => {
      const db = await loadAirportDb();
      if (!alive) return;
      const table = Object.fromEntries(
        Object.entries(db).map(([k, v]) => [k, { lat: v.lat, lon: v.lon }]),
      );
      setField(nearestAirport(lat, lon, table));
    })();
    return () => { alive = false; };
  }, [onGround, lat, lon]);

  if (status === "airborne") {
    return { label: "Airborne", live: true, title: "Airborne now — ADS-B" };
  }
  if (onGround && field) {
    return { label: field, live: true, title: `On the ground at ${field} — ADS-B` };
  }
  if (homeBase) {
    return { label: homeBase, live: false, title: "Home base — not a live position" };
  }
  return null;
}
