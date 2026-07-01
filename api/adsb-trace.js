export const config = { runtime: 'edge' };

export default async function handler(request) {
  const { searchParams } = new URL(request.url);
  const icao = searchParams.get('icao');
  if (!icao || !/^[0-9a-f]{6}$/i.test(icao)) {
    return new Response(JSON.stringify({ error: 'invalid icao' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }
  try {
    const upstream = `https://globe.adsbexchange.com/re-api/?find=trace&icao=${icao.toLowerCase()}`;
    const r = await fetch(upstream, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; AeroTrack/1.0)',
        'Accept': 'application/json',
        'Referer': 'https://globe.adsbexchange.com/',
      },
    });
    if (!r.ok) {
      return new Response(JSON.stringify({ error: 'upstream failed', status: r.status }), {
        status: r.status,
        headers: { 'Content-Type': 'application/json' },
      });
    }
    const data = await r.text();
    return new Response(data, {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'no-store',
        'Access-Control-Allow-Origin': '*',
      },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: e.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}
