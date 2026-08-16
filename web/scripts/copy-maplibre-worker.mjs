// MapLibre GL v6 spawns a MODULE worker resolved through import.meta.url. Under
// Next's bundler that URL does not resolve, so the worker starts but never
// answers — every GeoJSON layer stays invisible while raster tiles still draw.
//
// Fix: serve the worker (and the shared chunk it imports by relative path) from
// /public and point setWorkerUrl() at it. This script keeps those copies in
// sync with whatever version is installed; it runs on postinstall and prebuild
// so a maplibre upgrade can't leave a stale worker behind.
import { copyFileSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const from = join(here, "..", "node_modules", "maplibre-gl", "dist");
const to = join(here, "..", "public", "maplibre");

mkdirSync(to, { recursive: true });
for (const f of ["maplibre-gl-worker.mjs", "maplibre-gl-shared.mjs"]) {
  copyFileSync(join(from, f), join(to, f));
}
console.log("[maplibre] worker chunks copied to public/maplibre");
