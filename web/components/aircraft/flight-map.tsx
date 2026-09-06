"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Icon } from "@/components/ui/icon";
import * as maplibregl from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import { AP_FULL } from "@/lib/reference-data";
import { apLookup, loadAirportDb, onAirportDbUpgrade } from "@/lib/airports";
import { today, type RouteEntry, type V1Aircraft } from "@/lib/aircraft";
import { altColor, type TrackPoint } from "@/lib/adsb";
import { useAircraft } from "./detail-client";
import { getFlightTrack, listFlightHistory, type FlightHistoryRow } from "@/lib/flight-history";
import { Modal } from "@/components/ui/modal";
import { Confirm } from "@/components/ui/confirm";
import { useToast } from "@/components/ui/toast";

/** 32-segment great-circle arc between two [lon,lat] points (v1 used d3.geoInterpolate). */
function greatCircle(a: [number, number], b: [number, number]): [number, number][] {
  const toR = Math.PI / 180, toD = 180 / Math.PI;
  const [lon1, lat1] = [a[0] * toR, a[1] * toR];
  const [lon2, lat2] = [b[0] * toR, b[1] * toR];
  const d = 2 * Math.asin(Math.sqrt(
    Math.sin((lat2 - lat1) / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin((lon2 - lon1) / 2) ** 2,
  ));
  if (!d) return [a, b];
  const out: [number, number][] = [];
  for (let i = 0; i <= 32; i++) {
    const f = i / 32;
    const A = Math.sin((1 - f) * d) / Math.sin(d);
    const B = Math.sin(f * d) / Math.sin(d);
    const x = A * Math.cos(lat1) * Math.cos(lon1) + B * Math.cos(lat2) * Math.cos(lon2);
    const y = A * Math.cos(lat1) * Math.sin(lon1) + B * Math.cos(lat2) * Math.sin(lon2);
    const z = A * Math.sin(lat1) + B * Math.sin(lat2);
    out.push([Math.atan2(y, x) * toD, Math.atan2(z, Math.hypot(x, y)) * toD]);
  }
  return out;
}

// MapLibre v6 resolves its module worker via import.meta.url, which Next's
// bundler rewrites to a URL the worker can't load: it spawns, never answers,
// and every GeoJSON layer renders empty while raster tiles still draw. Point it
// at the copy in /public (kept in sync by scripts/copy-maplibre-worker.mjs).
maplibregl.setWorkerUrl("/maplibre/maplibre-gl-worker.mjs");

// CARTO began stamping "API KEY REQUIRED · carto.com/basemaps/apikey" diagonally
// across every basemap tile. It serves those at HTTP 200 as a valid PNG, so
// nothing failed, nothing logged, and the watermark simply appeared under the
// routes. Esri's canvas basemaps need no key and the satellite layer already
// came from there.
//
// Esri splits geography from labels, so each basemap is a pair: the base draws
// the land, the reference draws place names over it. Note {z}/{y}/{x} — Esri
// orders row before column, unlike XYZ.
const ESRI = "https://server.arcgisonline.com/ArcGIS/rest/services";

const BASEMAPS = {
  map: [`${ESRI}/Canvas/World_Dark_Gray_Base/MapServer/tile/{z}/{y}/{x}`],
  mapLight: [`${ESRI}/Canvas/World_Light_Gray_Base/MapServer/tile/{z}/{y}/{x}`],
  satellite: [`${ESRI}/World_Imagery/MapServer/tile/{z}/{y}/{x}`],
};

const LABELS = {
  map: [`${ESRI}/Canvas/World_Dark_Gray_Reference/MapServer/tile/{z}/{y}/{x}`],
  mapLight: [`${ESRI}/Canvas/World_Light_Gray_Reference/MapServer/tile/{z}/{y}/{x}`],
  satellite: [`${ESRI}/Reference/World_Boundaries_and_Places/MapServer/tile/{z}/{y}/{x}`],
};

type Mode = "airports" | "routes";

/** Current --accent as a hex string (v1's _getAccentHex). */
function accentHex(): string {
  if (typeof document === "undefined") return "#3b9eff";
  const v = getComputedStyle(document.documentElement).getPropertyValue("--accent").trim();
  return v || "#3b9eff";
}

/** Unhighlighted route colour, per basemap and theme (v1's _mlRouteBaseColor). */
function routeBaseColor(basemap: string, light: boolean): string {
  if (basemap === "satellite") return "#e2e8f0";
  return light ? "#5b6570" : "#c3cad3";
}

/**
 * Flight map. Restores v1's mode toggle (Airports / Routes), hover tooltips,
 * click-through airport and route detail, the ctrl+scroll hint, theme-reactive
 * basemaps, full-height canvas, and the ForeFlight CSV import that produced
 * the `flightRoutes` already on file.
 */
export function FlightMap({
  routes,
  airports,
  reg,
  data,
  save,
}: {
  routes: RouteEntry[];
  airports: [string, number][];
  reg?: string;
  data: V1Aircraft;
  save: (next: V1Aircraft) => Promise<void>;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const loadedRef = useRef(false);
  const [basemap, setBasemap] = useState<"map" | "satellite">("map");
  const [mode, setMode] = useState<Mode>("airports");
  const [ready, setReady] = useState(false);
  // v1's sizeMap(): the wrapper gets an explicit pixel height of W * 0.446.
  // An aspect-ratio box can still be 0-high when MapLibre is constructed,
  // which leaves the style permanently unloaded.
  const wrapRef = useRef<HTMLDivElement>(null);
  const [height, setHeight] = useState(0);
  const [hint, setHint] = useState(false);
  const [detail, setDetail] = useState<null | { kind: "airport" | "route"; code: string; to?: string; name?: string }>(null);
  const [confirmClear, setConfirmClear] = useState(false);
  const [importing, setImporting] = useState(false);
  // Post-import summary, mirroring v1's IMPORT REPORT bar.
  const [report, setReport] = useState<null | {
    flights: number; mapped: number; unknown: string[];
  }>(null);
  const [reportOpen, setReportOpen] = useState(false);
  // Resolved airport / leg counts for the map footer.
  const [plotted, setPlotted] = useState({ airports: 0, ops: 0 });
  // Last Flight replay (v1 _mlUpdateLastFlightBtn / _mlToggleLastFlight).
  const [lastFlight, setLastFlight] = useState<FlightHistoryRow | null>(null);
  const [replay, setReplay] = useState<TrackPoint[] | null>(null);
  const [replayBusy, setReplayBusy] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const { state: live, track } = useAircraft().live;
  // Read inside the map's load handler, which runs outside React's render.
  const basemapRef = useRef<"map" | "satellite">("map");
  // airport code → ids of every route touching it, for hover highlighting.
  const routeIndexRef = useRef<{ id: number; from: string; to: string }[]>([]);
  const hlRef = useRef<number[]>([]);
  const toast = useToast();

  // Latest data, read by applyData(). Kept in a ref so the map's load handler
  // and the data effect share one code path without re-creating the map.
  // Written in an effect, not during render — a render-phase ref write is a
  // side effect and trips the compiler.
  const dataRef = useRef({ routes, airports });
  useEffect(() => {
    dataRef.current = { routes, airports };
  }, [routes, airports]);

  const applyData = useCallback(async () => {
    // Resolve the airport DB first, then read the map — under StrictMode's
    // double-mount the instance held before this await can already have been
    // destroyed, and writing to it silently leaves the visible map empty.
    const ap = await loadAirportDb();
    const map = mapRef.current;
    if (!map || !map.getSource("airports")) return;

    const { routes: rs, airports: aps } = dataRef.current;
    const pts: Record<string, { coord: [number, number]; name: string; count: number }> = {};
    const counts = Object.fromEntries(aps);
    const legs: Record<string, { from: string; to: string; a: [number, number]; b: [number, number]; count: number }> = {};

    rs.forEach((r) => {
      const A = r.from ? apLookup(ap, r.from) : null;
      const B = r.to ? apLookup(ap, r.to) : null;
      if (A && r.from) pts[r.from] = { coord: [A.lon, A.lat], name: A.name, count: counts[r.from] ?? 1 };
      if (B && r.to) pts[r.to] = { coord: [B.lon, B.lat], name: B.name, count: counts[r.to] ?? 1 };
      if (A && B && r.from && r.to) {
        const key = [r.from, r.to].sort().join("|");
        if (legs[key]) legs[key].count++;
        else legs[key] = { from: r.from, to: r.to, a: [A.lon, A.lat], b: [B.lon, B.lat], count: 1 };
      }
    });

    (map.getSource("airports") as maplibregl.GeoJSONSource | undefined)?.setData({
      type: "FeatureCollection",
      features: Object.entries(pts).map(([code, v]) => ({
        type: "Feature",
        geometry: { type: "Point", coordinates: v.coord },
        properties: { code, name: v.name, count: v.count },
      })),
    });

    // Great-circle arcs, width scaled by how often the leg is flown — v1 built
    // 32-segment interpolated lines rather than straight two-point segments.
    const maxFreq = Math.max(1, ...Object.values(legs).map((l) => l.count));
    const feats = Object.values(legs).map((l, i) => ({
      type: "Feature" as const,
      id: i,
      geometry: { type: "LineString" as const, coordinates: greatCircle(l.a, l.b) },
      properties: {
        from: l.from, to: l.to, count: l.count,
        w: 1 + 3 * (l.count / maxFreq),
      },
    }));
    routeIndexRef.current = feats.map((f) => ({
      id: f.id, from: f.properties.from, to: f.properties.to,
    }));
    (map.getSource("routes") as maplibregl.GeoJSONSource | undefined)?.setData({
      type: "FeatureCollection", features: feats,
    });

    setPlotted({
      airports: Object.keys(pts).length,
      ops: Object.values(legs).reduce((n, l) => n + l.count, 0),
    });

    const coords = Object.values(pts).map((p) => p.coord);
    if (coords.length) {
      const b = new maplibregl.LngLatBounds();
      coords.forEach((c) => b.extend(c));
      map.fitBounds(b, { padding: 60, maxZoom: 8, duration: 0 });
    }
  }, []);

  const isLight = () =>
    typeof document !== "undefined" && document.documentElement.classList.contains("light");

  const tiles = useCallback(
    () => (basemap === "satellite" ? BASEMAPS.satellite : isLight() ? BASEMAPS.mapLight : BASEMAPS.map),
    [basemap],
  );
  const labelTiles = useCallback(
    () => (basemap === "satellite" ? LABELS.satellite : isLight() ? LABELS.mapLight : LABELS.map),
    [basemap],
  );

  // Track the wrapper's width and derive the map height from it.
  useEffect(() => {
    const wrap = wrapRef.current;
    if (!wrap) return;
    const measure = () => {
      const w = wrap.clientWidth;
      if (w > 0) setHeight(Math.round(w * 0.446));
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(wrap);
    return () => ro.disconnect();
  }, []);

  useEffect(() => {
    const host = ref.current;
    if (!host || mapRef.current || height === 0) return;

    const map = new maplibregl.Map({
      container: host,
      style: {
        version: 8,
        // Required for any symbol layer — without it addLayer("airport-labels")
        // throws and everything after it in the load handler is skipped.
        glyphs: "https://fonts.openmaptiles.org/{fontstack}/{range}.pbf",
        sources: {
          base: {
            type: "raster",
            tiles: tiles(),
            tileSize: 256,
            attribution: "© Esri · OpenStreetMap",
          },
          labels: { type: "raster", tiles: labelTiles(), tileSize: 256 },
        },
        layers: [
          { id: "bg", type: "background", paint: { "background-color": isLight() ? "#e8e8e6" : "#080e14" } },
          { id: "base", type: "raster", source: "base" },
          // Above the land, below everything this app draws — the route and
          // airport layers are added later, so they stack on top of it.
          { id: "labels", type: "raster", source: "labels" },
        ],
      },
      center: [-95, 39],
      zoom: 3,
      scrollZoom: false, // ctrl/⌘ + scroll only, as in v1
    });
    mapRef.current = map;
    map.on("error", (e) => console.error("[flight-map]", e.error?.message ?? e));


    let hintTimer = 0;
    const onWheel = (e: WheelEvent) => {
      if (e.ctrlKey || e.metaKey) {
        e.preventDefault();
        map.zoomTo(map.getZoom() + (e.deltaY > 0 ? -0.4 : 0.4), { duration: 120 });
        setHint(false);
      } else {
        setHint(true);
        window.clearTimeout(hintTimer);
        hintTimer = window.setTimeout(() => setHint(false), 1100);
      }
    };
    host.addEventListener("wheel", onWheel, { passive: false });

    map.on("load", () => {
      loadedRef.current = true;
      setReady(true);

      map.addSource("live", { type: "geojson", data: { type: "FeatureCollection", features: [] } });
      // Recorded track of the current flight, one segment per leg so each can
      // carry its own altitude colour (v1 painted a line-gradient).
      map.addSource("track", { type: "geojson", data: { type: "FeatureCollection", features: [] } });
      map.addSource("routes", { type: "geojson", data: { type: "FeatureCollection", features: [] } });
      map.addSource("airports", { type: "geojson", data: { type: "FeatureCollection", features: [] } });

      // Fill the sources as soon as they exist, before any further addLayer
      // call can throw and strand the map empty.
      applyData();

      // Route line: width scales with how often the leg is flown (`w`), and
      // highlighting adds 2.5 — v1's at-routes-l paint, verbatim.
      map.addLayer({
        id: "routes",
        type: "line",
        source: "routes",
        layout: { "line-cap": "round", "line-join": "round" },
        paint: {
          "line-color": [
            "case", ["boolean", ["feature-state", "hl"], false],
            accentHex(), routeBaseColor(basemapRef.current, isLight()),
          ],
          // to-number is required: MapLibre types ["get"] as `value`, and the
          // arithmetic operator rejects it, which throws at addLayer time and
          // aborts the rest of the load handler.
          "line-width": [
            "+",
            ["to-number", ["get", "w"], 1],
            ["case", ["boolean", ["feature-state", "hl"], false], 2.5, 0],
          ],
          "line-opacity": ["case", ["boolean", ["feature-state", "hl"], false], 1, 0.8],
        },
      });
      // Invisible wide hitbox so hovering a route doesn't demand pixel accuracy.
      map.addLayer({
        id: "routes-hit",
        type: "line",
        source: "routes",
        layout: { "line-cap": "round", "line-join": "round" },
        paint: { "line-color": "#000", "line-opacity": 0, "line-width": 16 },
      });
      map.addLayer({
        id: "airport-dots",
        type: "circle",
        source: "airports",
        paint: {
          "circle-radius": 5,
          "circle-color": accentHex(),
          "circle-stroke-color": "rgba(255,255,255,0.7)",
          "circle-stroke-width": 1.2,
        },
      });
      map.addLayer({
        id: "airport-labels",
        type: "symbol",
        source: "airports",
        minzoom: 6,
        layout: {
          "text-field": ["get", "code"],
          "text-size": 11,
          "text-offset": [0, 1.2],
          "text-anchor": "top",
          "text-font": ["Noto Sans Regular"],
        },
        paint: { "text-color": "#fff", "text-halo-color": "rgba(0,0,0,0.75)", "text-halo-width": 1 },
      });
      map.addLayer({
        id: "track-line",
        type: "line",
        source: "track",
        layout: { "line-cap": "round", "line-join": "round" },
        paint: { "line-color": ["get", "color"], "line-width": 2.4 },
      });
      map.addLayer({
        id: "live-dot",
        type: "circle",
        source: "live",
        paint: {
          "circle-radius": 7,
          "circle-color": "#00e164",
          "circle-stroke-color": "#04231a",
          "circle-stroke-width": 2,
        },
      });

      // Hover tooltips, airport-fan highlighting and click-through detail —
      // v1's _mlWireHover(), including the wide invisible hit layer for routes.
      const popup = new maplibregl.Popup({
        closeButton: false, closeOnClick: false, className: "ml-tip", offset: 10,
      });

      const setHl = (ids: number[]) => {
        hlRef.current.forEach((id) =>
          map.setFeatureState({ source: "routes", id }, { hl: false }));
        ids.forEach((id) => map.setFeatureState({ source: "routes", id }, { hl: true }));
        hlRef.current = ids;
      };

      map.on("mouseenter", "airport-dots", () => { map.getCanvas().style.cursor = "pointer"; });
      map.on("mousemove", "airport-dots", (e) => {
        const f = e.features?.[0];
        if (!f) return;
        const p = f.properties as { code: string; name?: string };
        popup
          .setLngLat((f.geometry as GeoJSON.Point).coordinates as [number, number])
          .setHTML(`<b>${p.code}</b>${p.name ? `<br>${p.name}` : ""}`)
          .addTo(map);
        // Light up every route touching this airport.
        setHl(
          routeIndexRef.current
            .filter((r) => r.from === p.code || r.to === p.code)
            .map((r) => r.id),
        );
      });
      map.on("mouseleave", "airport-dots", () => {
        map.getCanvas().style.cursor = "";
        popup.remove();
        setHl([]);
      });
      map.on("click", "airport-dots", (e) => {
        // Carry the resolved name in state — reading the db ref during render
        // is not reactive, so the modal would show a stale value.
        const p = e.features?.[0]?.properties as { code: string; name?: string } | undefined;
        if (p) setDetail({ kind: "airport", code: p.code, name: p.name });
      });

      map.on("mousemove", "routes-hit", (e) => {
        // An airport dot under the cursor wins — it highlights the whole fan.
        if (map.queryRenderedFeatures(e.point, { layers: ["airport-dots"] }).length) return;
        const f = e.features?.[0];
        if (f?.id == null) return;
        map.getCanvas().style.cursor = "pointer";
        setHl([f.id as number]);
      });
      map.on("mouseleave", "routes-hit", () => {
        map.getCanvas().style.cursor = "";
        setHl([]);
      });
      map.on("click", "routes-hit", (e) => {
        const p = e.features?.[0]?.properties as { from: string; to: string } | undefined;
        if (p) setDetail({ kind: "route", code: p.from, to: p.to });
      });

      // Fill the sources now that they exist. Doing it here (rather than only
      // from the data effect) avoids a race where "load" fires before the
      // effect subscribes and the map stays empty.
      applyData();
    });

    return () => {
      window.clearTimeout(hintTimer);
      host.removeEventListener("wheel", onWheel);
      map.remove();
      mapRef.current = null;
      loadedRef.current = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [height]);

  useEffect(() => {
    if (mapRef.current && height > 0) mapRef.current.resize();
  }, [height]);

  // Re-feed the sources when the route data changes after first load.
  useEffect(() => {
    if (loadedRef.current) applyData();
  }, [routes, airports, applyData]);

  // Is there a recorded flight to replay? (v1 _mlUpdateLastFlightBtn)
  useEffect(() => {
    let alive = true;
    if (!reg) return;
    listFlightHistory(reg, 1).then((rows) => {
      if (alive) setLastFlight(rows[0] ?? null);
    });
    return () => { alive = false; };
  }, [reg]);

  async function toggleReplay() {
    if (replay) { setReplay(null); return; }
    if (!lastFlight) return;
    setReplayBusy(true);
    const pts = await getFlightTrack(lastFlight.id);
    setReplayBusy(false);
    if (!pts.length) { toast("No stored track for that flight.", "warn"); return; }
    setReplay(pts);
    const map = mapRef.current;
    if (map) {
      const b = new maplibregl.LngLatBounds();
      pts.forEach((p) => b.extend([p.lon, p.lat]));
      map.fitBounds(b, { padding: 60, maxZoom: 10, duration: 600 });
    }
  }

  // Redraw once the FAA supplement lands and resolves more identifiers.
  useEffect(() => onAirportDbUpgrade(() => {
    if (loadedRef.current) applyData();
  }), [applyData]);

  // Mode toggle — Airports shows dots+labels, Routes shows the legs. Depends on
  // `ready` so the initial mode is applied once the layers actually exist.
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !ready) return;
    const vis = (id: string, on: boolean) => {
      if (map.getLayer(id)) map.setLayoutProperty(id, "visibility", on ? "visible" : "none");
    };
    vis("routes", mode === "routes");
    vis("routes-hit", mode === "routes");
    vis("airport-labels", mode === "airports");
  }, [mode, ready]);

  // Swap base tiles on toggle / theme change.
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !ready) return;
    const src = map.getSource("base") as maplibregl.RasterTileSource | undefined;
    const lbl = map.getSource("labels") as maplibregl.RasterTileSource | undefined;
    basemapRef.current = basemap;
    src?.setTiles?.(tiles());
    lbl?.setTiles?.(labelTiles());
    if (map.getLayer("routes")) {
      map.setPaintProperty("routes", "line-color", [
        "case", ["boolean", ["feature-state", "hl"], false],
        accentHex(), routeBaseColor(basemap, isLight()),
      ]);
    }
    if (map.getLayer("bg"))
      map.setPaintProperty("bg", "background-color", isLight() ? "#e8e8e6" : "#080e14");
  }, [basemap, tiles, labelTiles, ready]);

  // Push the live ADS-B position to the map marker as it polls.
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !ready) return;
    const src = map.getSource("live") as maplibregl.GeoJSONSource | undefined;
    if (!src) return;
    src.setData({
      type: "FeatureCollection",
      features:
        live && live.lat != null && live.lon != null
          ? [{
              type: "Feature",
              geometry: { type: "Point", coordinates: [live.lon, live.lat] },
              properties: {},
            }]
          : [],
    });
  }, [live, ready]);

  // Altitude-coloured breadcrumb — the flight in progress, or the replayed one.
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !ready) return;
    const src = map.getSource("track") as maplibregl.GeoJSONSource | undefined;
    if (!src) return;
    const shown = replay ?? track;
    const segments = shown.slice(1).map((p, i) => {
      const prev = shown[i];
      return {
        type: "Feature" as const,
        geometry: {
          type: "LineString" as const,
          coordinates: [
            [prev.lon, prev.lat],
            [p.lon, p.lat],
          ],
        },
        properties: { color: altColor(p.alt) },
      };
    });
    src.setData({ type: "FeatureCollection", features: segments });
  }, [track, replay, ready]);

  // ── ForeFlight CSV import (v1 parseFF) ────────────────────────────────────
  async function importCsv(file: File) {
    setImporting(true);
    try {
      const text = await file.text();
      const lines = text.split(/\r?\n/);
      // ForeFlight's export has a preamble of varying length before the flights
      // table, so locate the header row by its columns rather than by offset.
      let headerIdx = -1;
      let cols: string[] = [];
      for (let i = 0; i < lines.length; i++) {
        const c = lines[i].split(",").map((x) => x.replace(/"/g, "").trim().toLowerCase());
        if (c.includes("date") && c.includes("from") && c.includes("to")) {
          headerIdx = i;
          cols = c;
          break;
        }
      }
      if (headerIdx < 0) {
        toast("No Date/From/To header found — is this a ForeFlight logbook export?", "danger");
        return;
      }
      const di = cols.indexOf("date"), fi = cols.indexOf("from"), ti = cols.indexOf("to");
      const ai = cols.findIndex((c) => c === "aircraftid" || c === "aircraft id");

      const valid = (c: string) => /^[A-Z0-9]{2,6}$/.test(c);
      const found: RouteEntry[] = [];
      const seenCodes = new Set<string>();
      for (let i = headerIdx + 1; i < lines.length; i++) {
        if (!lines[i].trim()) continue;
        const c = lines[i].split(",").map((x) => x.replace(/"/g, "").trim());
        const from = (c[fi] ?? "").toUpperCase();
        const to = (c[ti] ?? "").toUpperCase();
        if (!valid(from) || !valid(to)) continue;
        const acId = ai >= 0 ? (c[ai] ?? "").toUpperCase() : "";
        // A whole-logbook export covers every aircraft — keep only this one's legs.
        if (reg && acId && acId.replace(/-/g, "") !== reg.toUpperCase().replace(/-/g, "")) continue;
        seenCodes.add(from);
        seenCodes.add(to);
        found.push({ from, to, date: c[di] || today(), reg, _fromCSV: true });
      }

      // Which identifiers the airport DB can't place — v1 surfaced this count
      // rather than dropping them silently.
      const db = await loadAirportDb();
      const unknown = [...seenCodes].filter((c) => !apLookup(db, c)).sort();

      if (!found.length) {
        toast("No matching flights found in that CSV.", "warn");
        return;
      }

      const existing = (data.flightRoutes ?? []) as RouteEntry[];
      const seen = new Set(existing.map((r) => `${r.from}>${r.to}|${r.date}`));
      const fresh = found.filter((r) => !seen.has(`${r.from}>${r.to}|${r.date}`));
      await save({ ...data, flightRoutes: [...existing, ...fresh] });
      setReport({
        flights: found.length,
        mapped: seenCodes.size - unknown.length,
        unknown,
      });
      toast(
        `Imported ${fresh.length} flight${fresh.length === 1 ? "" : "s"}` +
          (found.length - fresh.length ? ` (${found.length - fresh.length} already on file)` : ""),
        "ok",
      );
    } catch (e) {
      toast(`Import failed: ${(e as Error).message}`, "danger");
    } finally {
      setImporting(false);
    }
  }

  async function clearMapData() {
    await save({ ...data, flightRoutes: [], airportData: null });
    setConfirmClear(false);
    toast("Map data cleared", "ok");
  }

  const detailAirport = detail?.kind === "airport" ? detail.code : null;
  const routeLegs =
    detail?.kind === "route"
      ? routes.filter(
          (r) =>
            (r.from === detail.code && r.to === detail.to) ||
            (r.from === detail.to && r.to === detail.code),
        )
      : [];
  const airportLegs = detailAirport
    ? routes.filter((r) => r.from === detailAirport || r.to === detailAirport)
    : [];

  return (
    <>
      <div className="section-hd">
        <span className="section-label">
          Flight Map — <span style={{ color: "var(--accent)" }}>{reg}</span>
        </span>
        <div style={{ display: "flex", gap: 7, alignItems: "center", flexWrap: "wrap" }}>
          <span className="mono">{airports.length} airports · {routes.length} legs</span>
          <button className="btn sm" onClick={() => fileRef.current?.click()} disabled={importing}>
            {importing ? "Importing…" : "Import CSV"}
          </button>
          {routes.length > 0 && (
            <button className="btn sm" onClick={() => setConfirmClear(true)}>Clear</button>
          )}
          <input
            ref={fileRef}
            type="file"
            accept=".csv"
            style={{ display: "none" }}
            onChange={(e) => e.target.files?.[0] && importCsv(e.target.files[0])}
          />
        </div>
      </div>

      <div className="how-box">
        <b>Import from ForeFlight:</b> foreflight.com → Logbook → Export → Export CSV. Reads the
        ForeFlight format and maps every airport flown in <b>{reg}</b>. Manual flights logged via{" "}
        <b>Log Flight</b> also appear on the Routes view.
      </div>

      <div
        ref={wrapRef}
        style={{
          position: "relative",
          borderRadius: "var(--r)",
          overflow: "hidden",
          border: "1px solid var(--border2)",
        }}
      >
        <div ref={ref} style={{ width: "100%", height: height || 1 }} />

        <div className="map-ctl tl">
          {(["map", "satellite"] as const).map((b) => (
            <button key={b} className={`map-btn ${basemap === b ? "on" : ""}`} onClick={() => setBasemap(b)}>
              {b === "map" ? "Map" : "Satellite"}
            </button>
          ))}
        </div>

        <div className="map-ctl tr">
          {(["airports", "routes"] as const).map((m) => (
            <button key={m} className={`map-btn ${mode === m ? "on" : ""}`} onClick={() => setMode(m)}>
              {m === "airports" ? "Airports" : "Routes"}
            </button>
          ))}
        </div>

        <div className="map-ctl br">
          <button className="map-btn map-zoom" aria-label="Zoom in"
            onClick={() => mapRef.current?.zoomTo((mapRef.current?.getZoom() ?? 3) + 0.585)}>+</button>
          <button className="map-btn map-zoom" aria-label="Zoom out"
            onClick={() => mapRef.current?.zoomTo((mapRef.current?.getZoom() ?? 3) - 0.585)}>−</button>
        </div>

        {lastFlight && (
          <button
            className="map-btn map-lastflight"
            onClick={toggleReplay}
            disabled={replayBusy}
          >
            <Icon name="plane" size={13} />
            {replayBusy ? "Loading…" : replay ? "Hide Last Flight" : "Last Flight"}
          </button>
        )}

        {hint && (
          <div className="map-hint">
            Hold <b>Ctrl</b> + scroll to zoom · <b>⌘</b> on Mac
          </div>
        )}
      </div>

      <div className="map-foot">
        <span>Drag to pan · Ctrl/⌘ + scroll to zoom · Click a route or airport for details</span>
        <span className="mono">
          {plotted.airports} airports · {plotted.ops} operations
        </span>
      </div>

      {report && (
        <div className="import-report">
          <div className="import-report-hd" onClick={() => setReportOpen((o) => !o)}>
            <span className="import-report-lbl">Import Report</span>
            <span className="mono">
              {report.flights} flights · {report.mapped} mapped
            </span>
            {report.unknown.length > 0 && (
              <span className="badge warn">{report.unknown.length} unknown</span>
            )}
            <span className="import-report-tog">{reportOpen ? "▾" : "▸"}</span>
          </div>
          {reportOpen && (
            <div className="import-report-body">
              {report.unknown.length === 0 ? (
                <span className="mono">Every identifier resolved.</span>
              ) : (
                <>
                  <div className="mono" style={{ marginBottom: 6 }}>
                    Not found in the airport database — these legs are not plotted:
                  </div>
                  <div className="ap-chips" style={{ marginTop: 0 }}>
                    {report.unknown.map((c) => (
                      <span className="ap-chip" key={c} style={{ cursor: "default" }}>
                        <span className="acode">{c}</span>
                      </span>
                    ))}
                  </div>
                </>
              )}
            </div>
          )}
        </div>
      )}

      {/* v1 populated an #ap-chips list here but kept it style="display:none" —
          its only action, zoomTo(), drove the retired canvas renderer. Left out
          so the map's bottom edge matches: footer counts, then Import Report. */}

      {detail?.kind === "airport" && (
        <Modal title={detail.code} onClose={() => setDetail(null)}>
          <div className="ins-field">
            <span className="ins-field-label">Airport</span>
            <span className="ins-field-value">
              {AP_FULL[detail.code] ?? detail.name ?? detail.code}
            </span>
          </div>
          <div className="ins-field">
            <span className="ins-field-label">Visits</span>
            <span className="ins-field-value">
              {airports.find((a) => a[0] === detail.code)?.[1] ?? 0}
            </span>
          </div>
          <div className="form-divider">Legs</div>
          <ul className="log-list">
            {airportLegs.length === 0 ? (
              <li className="log-item">No legs recorded.</li>
            ) : (
              airportLegs.slice(0, 25).map((r, i) => (
                <li className="log-item" key={i}>
                  <span className="log-date">{r.date ?? "—"}</span>
                  <span className="log-note">{r.from} → {r.to}</span>
                </li>
              ))
            )}
          </ul>
        </Modal>
      )}

      {detail?.kind === "route" && (
        <Modal title={`${detail.code} → ${detail.to}`} onClose={() => setDetail(null)}>
          <div className="ins-field">
            <span className="ins-field-label">Flights on this route</span>
            <span className="ins-field-value">{routeLegs.length}</span>
          </div>
          <div className="form-divider">Dates</div>
          <ul className="log-list">
            {routeLegs.slice(0, 25).map((r, i) => (
              <li className="log-item" key={i}>
                <span className="log-date">{r.date ?? "—"}</span>
                <span className="log-note">{r.from} → {r.to}</span>
              </li>
            ))}
          </ul>
        </Modal>
      )}

      {confirmClear && (
        <Confirm
          title="Clear map data"
          message={
            <>
              Remove all {routes.length} recorded route legs for <b>{reg}</b>? Flights in the
              Flights tab are not affected.
            </>
          }
          confirmLabel="Clear routes"
          onConfirm={clearMapData}
          onCancel={() => setConfirmClear(false)}
        />
      )}
    </>
  );
}
