"use client";

/**
 * Airport coordinate database, ported from v1's _ensureApDb() +
 * _loadFaaSupplemental().
 *
 * The first port fetched the same ourairports CSV but parsed it with a naive
 * `split(",")` and indexed only the ICAO `ident` column. That fails three ways:
 *
 *  1. rows whose `name` contains a comma shift every later column, so lat/lon
 *     land in the wrong fields and the airport is silently dropped;
 *  2. US local/FAA identifiers (X06, X21, T82, FA40 …) live in `local_code`,
 *     not `ident`, so they never resolved at all;
 *  3. heliports, closed fields and balloonports were included as if they were
 *     airports.
 *
 * That is why a ForeFlight import reports identifiers as "unknown".
 */

export type Airport = { lat: number; lon: number; name: string };
export type AirportDb = Record<string, Airport>;

let _db: AirportDb | null = null;
let _promise: Promise<AirportDb> | null = null;

const OURAIRPORTS = "https://davidmegginson.github.io/ourairports-data/airports.csv";
// FAA/ADIP open data: X = lon, Y = lat, IDENT = local identifier, ICAO_ID.
const FAA = "https://opendata.arcgis.com/datasets/e747ab91a11045e8b3f8a3efd093d3b5_0.csv";

const SKIP_TYPES = new Set(["heliport", "closed", "balloonport"]);

/** Splits one CSV line, honouring double-quoted fields (v1 did this by hand). */
function splitCsvLine(line: string): string[] {
  const out: string[] = [];
  let cur = "";
  let inQ = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') inQ = !inQ;
    else if (ch === "," && !inQ) { out.push(cur); cur = ""; }
    else cur += ch;
  }
  out.push(cur);
  return out;
}

const usable = (code: string) => code.length >= 2 && code.length <= 6;

async function fetchText(url: string, ms: number): Promise<string | null> {
  try {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), ms);
    const r = await fetch(url, { signal: ctrl.signal });
    clearTimeout(timer);
    if (!r.ok) return null;
    return await r.text();
  } catch {
    return null;
  }
}

/** ourairports: index by ICAO ident AND by local_code (col 14). */
function loadOurAirports(text: string, db: AirportDb) {
  const lines = text.split("\n");
  for (let i = 1; i < lines.length; i++) {
    if (!lines[i]) continue;
    const cols = splitCsvLine(lines[i]);
    if (cols.length < 6) continue;
    if (SKIP_TYPES.has(cols[2]?.trim())) continue;

    const lat = parseFloat(cols[4]);
    const lon = parseFloat(cols[5]);
    if (Number.isNaN(lat) || Number.isNaN(lon)) continue;

    const name = (cols[3] ?? "").trim().replace(/"/g, "").slice(0, 32);
    const ident = (cols[1] ?? "").trim().replace(/"/g, "").toUpperCase();
    if (ident && usable(ident)) db[ident] = { lat, lon, name: name || ident };

    const local = (cols[14] ?? "").trim().replace(/"/g, "").toUpperCase();
    if (local && usable(local) && local !== ident) {
      db[local] = { lat, lon, name: name || local };
    }
  }
}

/** FAA/ADIP: fills in US local identifiers ourairports doesn't carry. */
function loadFaa(text: string, db: AirportDb) {
  const lines = text.split("\n");
  if (!lines.length) return;
  const hdr = splitCsvLine(lines[0]).map((h) =>
    h.replace(/^﻿/, "").replace(/"/g, "").trim().toUpperCase(),
  );
  const iLon = hdr.indexOf("X"), iLat = hdr.indexOf("Y");
  const iIdent = hdr.indexOf("IDENT"), iIcao = hdr.indexOf("ICAO_ID"), iName = hdr.indexOf("NAME");
  if (iLon < 0 || iLat < 0 || iIdent < 0) return;

  for (let i = 1; i < lines.length; i++) {
    if (!lines[i]) continue;
    const cols = splitCsvLine(lines[i]);
    const lat = parseFloat(cols[iLat]);
    const lon = parseFloat(cols[iLon]);
    if (Number.isNaN(lat) || Number.isNaN(lon)) continue;

    const name = (cols[iName] ?? "").trim().replace(/"/g, "").slice(0, 32);
    const ident = (cols[iIdent] ?? "").trim().replace(/"/g, "").toUpperCase();
    if (ident && usable(ident) && !db[ident]) db[ident] = { lat, lon, name: name || ident };

    if (iIcao >= 0) {
      const icao = (cols[iIcao] ?? "").trim().replace(/"/g, "").toUpperCase();
      if (icao && usable(icao) && !db[icao]) db[icao] = { lat, lon, name: name || icao };
    }
  }
}

const _upgradeSubs = new Set<() => void>();

/**
 * Fires when the FAA supplement finishes merging in, so callers can redraw.
 * v1 did the same: draw from ourairports immediately, then redraw once the
 * local identifiers land — waiting on both would stall the map behind a second
 * multi-megabyte download.
 */
export function onAirportDbUpgrade(cb: () => void): () => void {
  _upgradeSubs.add(cb);
  return () => _upgradeSubs.delete(cb);
}

/** Loads (once per session) and returns the airport database. */
export function loadAirportDb(): Promise<AirportDb> {
  if (_db) return Promise.resolve(_db);
  if (_promise) return _promise;

  _promise = (async () => {
    const db: AirportDb = {};
    const main = await fetchText(OURAIRPORTS, 20_000);
    if (main) loadOurAirports(main, db);
    _db = db;

    // Best-effort supplement, in the background — a failure or a slow response
    // must never hold up (or blank) the map.
    void (async () => {
      const faa = await fetchText(FAA, 15_000);
      if (!faa) return;
      const before = Object.keys(db).length;
      loadFaa(faa, db);
      if (Object.keys(db).length > before) _upgradeSubs.forEach((cb) => cb());
    })();

    return db;
  })();

  return _promise;
}

/** v1's apLookup(): exact match, else try the US "K" prefix. */
export function apLookup(db: AirportDb, code: string): Airport | null {
  const c = (code || "").trim().toUpperCase();
  if (!c) return null;
  return (
    db[c] ??
    (!c.startsWith("K") && c.length <= 4 ? db["K" + c] : null) ??
    (c.startsWith("K") ? db[c.slice(1)] : null) ??
    null
  );
}
