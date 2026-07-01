export const config = { runtime: 'edge' };

// Full flight-track proxy — returns the current flight's departure→now route.
//
// ADSBexchange's own globe trace files (and their RapidAPI plan) are not usable
// for history: RapidAPI only serves live snapshots, and the globe re-api now
// 403s outside clients. So we pull the trace from adsb.lol, a free open network
// that publishes trace files in the identical tar1090/ADSBexchange format and
// has strong GA coverage. OpenSky /tracks is kept as a fallback.
//
// Both sources block browser CORS, so this MUST run server-side (Edge Function);
// a direct browser fetch would fail. Output is normalized to the points the
// client draws: {lat, lon, alt(ft), ts(ms), track}.
export default async function handler(request) {
  const { searchParams } = new URL(request.url);
  const icao = (searchParams.get('icao') || '').toLowerCase();
  if (!/^[0-9a-f]{6}$/.test(icao)) return json({ error: 'invalid icao' }, 400);

  // 1) adsb.lol trace_full (ADSBexchange trace format)
  try {
    const ll = icao.slice(-2);
    const r = await fetch(`https://globe.adsb.lol/data/traces/${ll}/trace_full_${icao}.json`, {
      headers: { 'User-Agent': 'AeroTrack/1.0', 'Accept': 'application/json' },
    });
    if (r.ok) {
      const d = await r.json();
      const points = fromTraceFormat(d);
      if (points.length >= 2) {
        return json({ source: 'adsb.lol', reg: d.r || null, points }, 200);
      }
    }
  } catch (e) { /* fall through to OpenSky */ }

  // 2) OpenSky /tracks/all fallback  (path row: [ts, lat, lon, alt_m, track, on_ground])
  try {
    const r = await fetch(`https://opensky-network.org/api/tracks/all?icao24=${icao}&time=0`, {
      headers: { 'User-Agent': 'AeroTrack/1.0', 'Accept': 'application/json' },
    });
    if (r.ok) {
      const d = await r.json();
      const path = Array.isArray(d && d.path) ? d.path : [];
      const points = [];
      for (const p of path) {
        if (!Array.isArray(p) || p[1] == null || p[2] == null || p[5] === true) continue;
        const altM = typeof p[3] === 'number' ? p[3] : null;
        points.push({
          lat: p[1], lon: p[2],
          alt: altM == null ? 0 : Math.round(altM * 3.28084),
          ts: (p[0] || 0) * 1000,
          track: typeof p[4] === 'number' ? p[4] : null,
        });
      }
      if (points.length >= 2) {
        return json({ source: 'opensky', callsign: (d.callsign || '').trim(), points }, 200);
      }
    }
  } catch (e) { /* fall through */ }

  return json({ error: 'no trace available', points: [] }, 404);
}

// Parse a tar1090/ADSBexchange trace file and return only the *current* flight
// leg (from the last ground/gap boundary to the end), altitude already in feet.
//   trace row: [offset_sec, lat, lon, alt_ft|"ground", gs_kt, track_deg, ...]
function fromTraceFormat(d) {
  const trace = Array.isArray(d && d.trace) ? d.trace : [];
  const base = d.timestamp || 0;
  const rows = [];
  for (const t of trace) {
    if (!Array.isArray(t) || t[1] == null || t[2] == null) continue;
    const ground = t[3] === 'ground';
    rows.push({
      ts: (base + (t[0] || 0)) * 1000,
      lat: t[1], lon: t[2],
      alt: typeof t[3] === 'number' ? t[3] : 0,
      track: typeof t[5] === 'number' ? t[5] : null,
      ground,
    });
  }
  if (!rows.length) return [];
  // Walk back from the end; the current leg starts after the last ground sample
  // or after any gap > 30 min (a separate earlier flight the same day).
  let start = 0;
  for (let i = rows.length - 1; i > 0; i--) {
    if (rows[i - 1].ground || rows[i].ts - rows[i - 1].ts > 30 * 60 * 1000) { start = i; break; }
  }
  return rows.slice(start)
    .filter(r => !r.ground)
    .map(r => ({ lat: r.lat, lon: r.lon, alt: r.alt, ts: r.ts, track: r.track }));
}

function json(obj, status) {
  return new Response(JSON.stringify(obj), {
    status,
    headers: {
      'Content-Type': 'application/json',
      'Cache-Control': 'no-store',
      'Access-Control-Allow-Origin': '*',
    },
  });
}
