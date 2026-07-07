// AeroTrack — background flight monitor (Supabase Edge Function, Deno).
//
// Invoked by pg_cron every ~5 min. For every row in monitored_aircraft it pulls
// the aircraft's ADS-B trace from adsb.lol (free, keyless, server-side only —
// the user's RapidAPI key is client-side and unusable here), splits it into
// completed flight legs, and inserts any leg that ended AFTER the stored
// watermark into flight_history. The unique (user_id, aircraft_id, dep_ts)
// constraint makes this idempotent and dedupes against live client inserts.
//
// Env required:
//   SUPABASE_URL              (auto-provided)
//   SUPABASE_SERVICE_ROLE_KEY (auto-provided) — bypasses RLS for writes
//   MONITOR_SECRET            — shared secret; the cron call must send it
//
// deno-lint-ignore-file no-explicit-any
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const CONCURRENCY = 5;          // aircraft fetched in parallel
const LEG_GAP_MS = 30 * 60_000; // gap that separates two flights the same day
const MAX_POINTS = 1000;        // decimation cap per stored track

Deno.serve(async (req) => {
  // ── Auth: reject anything without the shared secret ──────────────────────
  const secret = Deno.env.get("MONITOR_SECRET");
  const auth = req.headers.get("Authorization") || "";
  if (!secret || auth !== `Bearer ${secret}`) {
    return json({ error: "unauthorized" }, 401);
  }

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    { auth: { persistSession: false } },
  );

  const { data: rows, error } = await supabase
    .from("monitored_aircraft")
    .select("user_id, aircraft_id, reg, icao24, last_arr_ts");
  if (error) return json({ error: error.message }, 500);
  if (!rows?.length) return json({ polled: 0, inserted: 0 });

  await ensureAirports();

  let inserted = 0;
  for (let i = 0; i < rows.length; i += CONCURRENCY) {
    const batch = rows.slice(i, i + CONCURRENCY);
    const results = await Promise.all(batch.map((r) => processAircraft(supabase, r)));
    inserted += results.reduce((a, b) => a + b, 0);
  }

  return json({ polled: rows.length, inserted });
});

// ── Per-aircraft: fetch trace, extract new legs, insert, advance watermark ──
async function processAircraft(supabase: any, row: any): Promise<number> {
  const hex = /^[0-9a-f]{6}$/i.test(row.icao24 || "")
    ? String(row.icao24).toLowerCase()
    : nToHex(row.reg);
  const nowIso = new Date().toISOString();
  if (!hex) {
    await supabase.from("monitored_aircraft")
      .update({ last_polled: nowIso, updated_at: nowIso })
      .eq("user_id", row.user_id).eq("aircraft_id", row.aircraft_id);
    return 0;
  }

  const trace = await fetchTrace(hex);
  const watermark = row.last_arr_ts ? Date.parse(row.last_arr_ts) : 0;
  let newestArr = watermark;
  let count = 0;

  if (trace) {
    // Only completed legs (ended on the ground) that are newer than watermark.
    for (const leg of completedLegs(trace.points)) {
      const arrTs = leg[leg.length - 1].ts;
      if (arrTs <= watermark) continue;
      const flight = buildFlight(row, hex, leg, trace.reg, trace.source);
      const { error } = await supabase
        .from("flight_history")
        .upsert(flight, { onConflict: "user_id,aircraft_id,dep_ts", ignoreDuplicates: true });
      if (!error) { count++; if (arrTs > newestArr) newestArr = arrTs; }
    }
  }

  await supabase.from("monitored_aircraft").update({
    last_polled: nowIso,
    updated_at: nowIso,
    ...(newestArr > watermark ? { last_arr_ts: new Date(newestArr).toISOString() } : {}),
    ...(hex && !row.icao24 ? { icao24: hex } : {}),
  }).eq("user_id", row.user_id).eq("aircraft_id", row.aircraft_id);

  return count;
}

// ── adsb.lol trace fetch (mirrors api/adsb-trace.js) ────────────────────────
async function fetchTrace(icao: string): Promise<{ points: Row[]; reg: string | null; source: string } | null> {
  const ll = icao.slice(-2);
  const opts = { headers: { "User-Agent": "AeroTrack/1.0", "Accept": "application/json" } };
  try {
    const [rFull, rRecent] = await Promise.allSettled([
      fetch(`https://globe.adsb.lol/data/traces/${ll}/trace_full_${icao}.json`, opts),
      fetch(`https://globe.adsb.lol/data/traces/${ll}/trace_recent_${icao}.json`, opts),
    ]);
    let rows: Row[] = [], reg: string | null = null;
    if (rFull.status === "fulfilled" && rFull.value.ok) {
      const d = await rFull.value.json();
      rows = traceRows(d); reg = d.r || null;
    }
    if (rRecent.status === "fulfilled" && rRecent.value.ok) {
      const d2 = await rRecent.value.json();
      const recent = traceRows(d2);
      const lastTs = rows.length ? rows[rows.length - 1].ts : 0;
      for (const p of recent) if (p.ts > lastTs) rows.push(p);
      if (!reg) reg = d2.r || null;
    }
    if (rows.length >= 2) return { points: rows, reg, source: "adsb.lol" };
  } catch { /* ignore */ }
  return null;
}

type Row = { ts: number; lat: number; lon: number; alt: number; track: number | null; ground: boolean };

// Parse a tar1090/ADSBexchange trace file into raw rows (keeps ground samples,
// which mark the leg boundaries). Row: [offset_s, lat, lon, alt_ft|"ground", gs, track, ...]
function traceRows(d: any): Row[] {
  const trace = Array.isArray(d?.trace) ? d.trace : [];
  const base = d?.timestamp || 0;
  const out: Row[] = [];
  for (const t of trace) {
    if (!Array.isArray(t) || t[1] == null || t[2] == null) continue;
    out.push({
      ts: (base + (t[0] || 0)) * 1000,
      lat: t[1], lon: t[2],
      alt: typeof t[3] === "number" ? t[3] : 0,
      track: typeof t[5] === "number" ? t[5] : null,
      ground: t[3] === "ground",
    });
  }
  return out;
}

// Split rows into COMPLETED legs: an airborne segment bounded by ground/gaps on
// both sides. A leg is "completed" only if it is followed by a ground sample or
// a >30-min gap (i.e. the aircraft has landed) — an in-progress flight at the
// end of the trace is intentionally skipped so we don't store partial flights.
function completedLegs(rows: Row[]): Row[][] {
  const legs: Row[][] = [];
  let cur: Row[] = [];
  const flush = (closed: boolean) => {
    const air = cur.filter((r) => !r.ground);
    if (closed && air.length >= 2) legs.push(air);
    cur = [];
  };
  for (let i = 0; i < rows.length; i++) {
    const r = rows[i];
    const gap = i > 0 && r.ts - rows[i - 1].ts > LEG_GAP_MS;
    if (gap) flush(true);            // gap → previous leg has landed
    if (r.ground) { flush(true); continue; } // ground → boundary, leg completed
    cur.push(r);
  }
  flush(false);                      // trailing airborne run = still flying → drop
  return legs;
}

function buildFlight(row: any, hex: string, leg: Row[], reg: string | null, source: string) {
  const dep = leg[0], arr = leg[leg.length - 1];
  const pts = decimate(leg).map((p) => ({ lat: p.lat, lon: p.lon, alt: Math.round(p.alt) || 0, ts: p.ts }));
  let maxAlt = 0;
  for (const p of pts) if (p.alt > maxAlt) maxAlt = p.alt;
  const depCode = nearestAirport(dep.lat, dep.lon);
  const arrCode = nearestAirport(arr.lat, arr.lon);
  return {
    user_id: row.user_id,
    aircraft_id: row.aircraft_id,
    reg: reg || row.reg,
    icao24: hex,
    dep_code: depCode,
    arr_code: arrCode,
    dep_lat: dep.lat, dep_lon: dep.lon,
    arr_lat: arr.lat, arr_lon: arr.lon,
    dep_ts: new Date(dep.ts).toISOString(),
    arr_ts: new Date(arr.ts).toISOString(),
    duration_h: Number(((arr.ts - dep.ts) / 3_600_000).toFixed(1)),
    max_alt: maxAlt,
    distance_nm: Number(pathDistanceNm(pts).toFixed(0)),
    point_count: pts.length,
    track: pts,
    source,
  };
}

// Keep at most MAX_POINTS, dropping samples where heading + altitude barely
// change (straight-and-level cruise) so turns/climbs keep their fidelity.
function decimate(leg: Row[]): Row[] {
  if (leg.length <= MAX_POINTS) return leg;
  const keep = [leg[0]];
  let lastTrack = leg[0].track, lastAlt = leg[0].alt;
  for (let i = 1; i < leg.length - 1; i++) {
    const r = leg[i];
    const dTrack = lastTrack != null && r.track != null ? Math.abs(r.track - lastTrack) : 999;
    const dAlt = Math.abs(r.alt - lastAlt);
    if (dTrack > 3 || dAlt > 200) { keep.push(r); lastTrack = r.track; lastAlt = r.alt; }
  }
  keep.push(leg[leg.length - 1]);
  // Still too many after angle/alt filtering → uniform subsample.
  if (keep.length > MAX_POINTS) {
    const step = keep.length / MAX_POINTS;
    const out: Row[] = [];
    for (let i = 0; i < keep.length; i += step) out.push(keep[Math.floor(i)]);
    if (out[out.length - 1] !== keep[keep.length - 1]) out.push(keep[keep.length - 1]);
    return out;
  }
  return keep;
}

function pathDistanceNm(pts: { lat: number; lon: number }[]): number {
  let d = 0;
  for (let i = 1; i < pts.length; i++) d += haversineNm(pts[i - 1], pts[i]);
  return d;
}
function haversineNm(a: { lat: number; lon: number }, b: { lat: number; lon: number }): number {
  const R = 3440.065; // nm
  const dLat = (b.lat - a.lat) * Math.PI / 180, dLon = (b.lon - a.lon) * Math.PI / 180;
  const la1 = a.lat * Math.PI / 180, la2 = b.lat * Math.PI / 180;
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(la1) * Math.cos(la2) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(h)));
}

// ── Airport DB (OurAirports CSV) — loaded once, cached warm across invokes ───
type Ap = { code: string; lat: number; lon: number };
let AIRPORTS: Ap[] | null = null;
async function ensureAirports() {
  if (AIRPORTS) return;
  try {
    const r = await fetch("https://davidmegginson.github.io/ourairports-data/airports.csv");
    if (!r.ok) { AIRPORTS = []; return; }
    const text = await r.text();
    const lines = text.split("\n");
    const out: Ap[] = [];
    for (let i = 1; i < lines.length; i++) {
      const cols = parseCsvLine(lines[i]);
      if (cols.length < 6) continue;
      const type = cols[2]?.trim();
      if (type === "heliport" || type === "closed" || type === "balloonport") continue;
      const lat = parseFloat(cols[4]), lon = parseFloat(cols[5]);
      if (isNaN(lat) || isNaN(lon)) continue;
      const ident = cols[1]?.trim().toUpperCase();
      const local = cols[14]?.trim().toUpperCase();
      const code = local && local.length >= 2 && local.length <= 6 ? local
        : (ident && ident.length >= 2 && ident.length <= 6 ? ident : null);
      if (code) out.push({ code, lat, lon });
    }
    AIRPORTS = out;
  } catch { AIRPORTS = []; }
}
function parseCsvLine(line: string): string[] {
  const cols: string[] = []; let cur = "", inQ = false;
  for (let j = 0; j < line.length; j++) {
    const ch = line[j];
    if (ch === '"') inQ = !inQ;
    else if (ch === "," && !inQ) { cols.push(cur); cur = ""; }
    else cur += ch;
  }
  cols.push(cur);
  return cols;
}
// Nearest airport within ~30nm (0.5° hypot, matching the client's _nearestAirport).
function nearestAirport(lat: number | null, lon: number | null): string | null {
  if (lat == null || lon == null || !AIRPORTS) return null;
  let best: string | null = null, bestD = Infinity;
  for (const ap of AIRPORTS) {
    const d = Math.hypot(ap.lat - lat, ap.lon - lon);
    if (d < bestD) { bestD = d; best = ap.code; }
  }
  return bestD < 0.5 ? best : null;
}

// N-number → ICAO hex (port of client _nToHex).
function nToHex(nNum: string): string | null {
  const raw = (nNum || "").trim().toUpperCase().replace(/^N/, "");
  if (!raw) return null;
  const ALPHA = "ABCDEFGHJKLMNPQRSTUVWXYZ";
  const parts = raw.match(/^([0-9]{1,5})([A-HJ-NP-Z]?)([A-HJ-NP-Z]?)$/);
  if (!parts) return null;
  const num = parseInt(parts[1], 10);
  if (num < 1 || num > 99999) return null;
  const i1 = parts[2] ? ALPHA.indexOf(parts[2]) + 1 : 0;
  const i2 = parts[3] ? ALPHA.indexOf(parts[3]) + 1 : 0;
  const BASE = 0xA00001, SLOTS = 601;
  const sufOff = i1 > 0 ? 1 + (i1 - 1) * 25 + (i2 > 0 ? i2 : 0) : 0;
  return (BASE + (num - 1) * SLOTS + sufOff).toString(16).toLowerCase();
}

function json(obj: unknown, status = 200) {
  return new Response(JSON.stringify(obj), {
    status,
    headers: { "Content-Type": "application/json", "Cache-Control": "no-store" },
  });
}
