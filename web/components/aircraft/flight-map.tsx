"use client";

import { useEffect, useRef, useState } from "react";
import * as maplibregl from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import type { FlightEntry } from "@/lib/aircraft";

// Module-scoped airport cache so the (large) ourairports CSV loads at most once
// per session — same source the original app used.
type Airports = Record<string, { lat: number; lon: number; name: string }>;
let _apCache: Airports | null = null;
let _apPromise: Promise<Airports> | null = null;

async function loadAirports(): Promise<Airports> {
  if (_apCache) return _apCache;
  if (_apPromise) return _apPromise;
  _apPromise = (async () => {
    const res = await fetch(
      "https://davidmegginson.github.io/ourairports-data/airports.csv",
    );
    const text = await res.text();
    const out: Airports = {};
    const lines = text.split("\n");
    // Columns: id,ident,type,name,latitude_deg,longitude_deg,...
    for (let i = 1; i < lines.length; i++) {
      const c = lines[i].split(",");
      if (c.length < 6) continue;
      const ident = c[1]?.replace(/"/g, "");
      const lat = parseFloat(c[4]);
      const lon = parseFloat(c[5]);
      if (!ident || Number.isNaN(lat) || Number.isNaN(lon)) continue;
      out[ident] = { lat, lon, name: c[3]?.replace(/"/g, "") ?? ident };
    }
    _apCache = out;
    return out;
  })();
  return _apPromise;
}

// Strip/add the leading K for US identifiers, matching apLookup() in v1.
function lookup(ap: Airports, code: string) {
  const c = code.trim().toUpperCase();
  return ap[c] || ap["K" + c] || (c.startsWith("K") ? ap[c.slice(1)] : null);
}

const BASEMAPS = {
  map: ["https://a.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}@2x.png"],
  satellite: [
    "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",
  ],
};

export function FlightMap({ flights }: { flights: FlightEntry[] }) {
  const ref = useRef<HTMLDivElement>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const [basemap, setBasemap] = useState<"map" | "satellite">("map");

  useEffect(() => {
    if (!ref.current || mapRef.current) return;
    const map = new maplibregl.Map({
      container: ref.current,
      style: {
        version: 8,
        sources: {
          base: { type: "raster", tiles: BASEMAPS.map, tileSize: 256, attribution: "© OpenStreetMap · CARTO · Esri" },
        },
        layers: [
          { id: "bg", type: "background", paint: { "background-color": "#080e14" } },
          { id: "base", type: "raster", source: "base" },
        ],
      },
      center: [-95, 39],
      zoom: 3,
    });
    mapRef.current = map;

    map.on("load", async () => {
      const ap = await loadAirports();
      if (!ap) return;

      const pts: Record<string, [number, number]> = {};
      const routes: { from: [number, number]; to: [number, number] }[] = [];
      flights.forEach((f) => {
        const a = f.from ? lookup(ap, f.from) : null;
        const b = f.to ? lookup(ap, f.to) : null;
        if (a) pts[f.from!] = [a.lon, a.lat];
        if (b) pts[f.to!] = [b.lon, b.lat];
        if (a && b) routes.push({ from: [a.lon, a.lat], to: [b.lon, b.lat] });
      });

      map.addSource("routes", {
        type: "geojson",
        data: {
          type: "FeatureCollection",
          features: routes.map((r) => ({
            type: "Feature",
            geometry: { type: "LineString", coordinates: [r.from, r.to] },
            properties: {},
          })),
        },
      });
      map.addLayer({
        id: "routes",
        type: "line",
        source: "routes",
        paint: { "line-color": "#888", "line-width": 1.5, "line-opacity": 0.8 },
      });

      map.addSource("airports", {
        type: "geojson",
        data: {
          type: "FeatureCollection",
          features: Object.entries(pts).map(([code, coord]) => ({
            type: "Feature",
            geometry: { type: "Point", coordinates: coord },
            properties: { code },
          })),
        },
      });
      map.addLayer({
        id: "airport-dots",
        type: "circle",
        source: "airports",
        paint: {
          "circle-radius": 5,
          "circle-color": "#3b9eff",
          "circle-stroke-color": "#0f0f0f",
          "circle-stroke-width": 2,
        },
      });
      map.addLayer({
        id: "airport-labels",
        type: "symbol",
        source: "airports",
        layout: { "text-field": ["get", "code"], "text-size": 11, "text-offset": [0, 1.3] },
        paint: { "text-color": "#aaa", "text-halo-color": "#0f0f0f", "text-halo-width": 1 },
      });

      const coords = Object.values(pts);
      if (coords.length) {
        const b = new maplibregl.LngLatBounds();
        coords.forEach((c) => b.extend(c));
        map.fitBounds(b, { padding: 60, maxZoom: 8, duration: 0 });
      }
    });

    return () => {
      map.remove();
      mapRef.current = null;
    };
  }, [flights]);

  // Swap base tiles on toggle.
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !map.isStyleLoaded()) return;
    const src = map.getSource("base") as maplibregl.RasterTileSource | undefined;
    if (src?.setTiles) src.setTiles(BASEMAPS[basemap]);
  }, [basemap]);

  return (
    <div style={{ position: "relative", borderRadius: "var(--r)", overflow: "hidden", border: "1px solid var(--border2)" }}>
      <div ref={ref} style={{ height: 380, width: "100%" }} />
      <div style={{ position: "absolute", top: 10, left: 10, display: "flex", gap: 4, zIndex: 5 }}>
        {(["map", "satellite"] as const).map((b) => (
          <button
            key={b}
            className={`btn sm ${basemap === b ? "primary" : ""}`}
            onClick={() => setBasemap(b)}
          >
            {b === "map" ? "Map" : "Satellite"}
          </button>
        ))}
      </div>
    </div>
  );
}
