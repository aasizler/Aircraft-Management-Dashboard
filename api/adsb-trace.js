export const config = { runtime: 'edge' };

// Full flight-track proxy.
// ADSBexchange's globe re-api (previously used here) now returns 403 to
// non-browser clients, so the full departure→current trace never loaded.
// OpenSky's /tracks/all endpoint returns the whole current-flight path and
// works server-side (no browser CORS), so we proxy it here and normalize the
// rows into the {lat,lon,alt,ts} points the client already consumes.
//
// OpenSky path row: [time_unix_s, lat, lon, baro_altitude_m, true_track_deg, on_ground]
export default async function handler(request) {
  const { searchParams } = new URL(request.url);
  const icao = (searchParams.get('icao') || '').toLowerCase();
  if (!/^[0-9a-f]{6}$/.test(icao)) return json({ error: 'invalid icao' }, 400);

  try {
    const upstream = `https://opensky-network.org/api/tracks/all?icao24=${icao}&time=0`;
    const r = await fetch(upstream, {
      headers: { 'User-Agent': 'AeroTrack/1.0', 'Accept': 'application/json' },
    });
    if (!r.ok) {
      return json({ error: 'upstream failed', status: r.status }, r.status === 404 ? 404 : 502);
    }
    const d = await r.json();
    const path = Array.isArray(d && d.path) ? d.path : [];
    const points = [];
    for (const p of path) {
      if (!Array.isArray(p) || p[1] == null || p[2] == null) continue;
      if (p[5] === true) continue; // skip on-ground samples
      const altM = typeof p[3] === 'number' ? p[3] : null;
      points.push({
        lat: p[1],
        lon: p[2],
        alt: altM == null ? 0 : Math.round(altM * 3.28084), // metres → feet
        ts: (p[0] || 0) * 1000,
        track: typeof p[4] === 'number' ? p[4] : null,
      });
    }
    return json({ source: 'opensky', callsign: (d.callsign || '').trim(), points }, 200);
  } catch (e) {
    return json({ error: e.message }, 500);
  }
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
