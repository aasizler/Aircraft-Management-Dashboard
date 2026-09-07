# Aircraft silhouettes — redrawn design handoff

Five replacement map silhouettes for AeroTrack. This handoff preserves the existing keys and rendering contract. The drawings are original, informed by the aircraft planforms and small-map readability of ADS-B Exchange/tar1090. They are class symbols, not exact scale drawings or copies of the upstream assets.

This document contains the full replacement geometry. Application source code has not been changed as part of this design handoff.

## Rendering contract

- Canvas: `viewBox="0 0 100 100"`; all visible geometry stays within 2–98 on both axes.
- Orientation: nose up; all five silhouettes are left-right symmetric about x=50. Continue rotating the whole SVG by track about (50,50).
- One `<path>` per key; no stroke, gradients, groups, filters or baked colours.
- Preserve `fill-rule="evenodd"` already used by the live marker. The helicopter uses two closed subpaths inside that one element: one outer contour and one hollow interior.
- The caller sets the fill at runtime. Keep the existing airborne/ground colour behaviour, marker pulse and movement animation.
- Render at 30 × 30 px, except `airliner` at 34 × 34 px, as the current code does.
- Preserve the `Shape` union and `SILHOUETTE` keys: `single`, `twin`, `jet`, `airliner`, `heli`.

## Design changes

| Key | Design |
|---|---|
| `single` | Straight, broad wings; compact nose; tapered rear fuselage and conventional tail. |
| `twin` | Two prominent nacelles ahead of a near-straight wing; longer fuselage and wider tail. |
| `jet` | Swept wings, rear-mounted engine pods and a broad rear stabilizer. |
| `airliner` | Fuller fuselage, swept wings and visibly separate underwing-engine bulges. |
| `heli` | Rounded cabin, narrow tail boom and a true hollow circular rotor ring. |

The single and twin have near-straight wings instead of the strongly swept placeholder wings. The twin's nacelles project ahead of the wing and remain substantial at 30 px. The business jet uses aft-mounted engines; the airliner has a fuller fuselage and underwing-engine bulges. These engine placements provide the primary distinction between the two jet classes.

The helicopter retains the hollow rotor ring requested in the original brief. The cabin and tail are incorporated into the ring's contours so `evenodd` does not accidentally erase the body at overlapping boundaries. This differs from the crossed-blade helicopter variants in tar1090. A top-down flat silhouette cannot literally express a T-tail's vertical height; the business jet represents it with the rear stabilizer planform.

## Replacement strings

Replace only the `SILHOUETTE` object in `web/lib/silhouettes.ts` with this block. Retain the existing exported `Shape` type and classifier while applying this artwork change. The type sets and selection logic are a separate concern, described below.

```ts
// Original AeroTrack map silhouettes. North-up, symmetric, 100 x 100.
// Preserve runtime fill and evenodd; all geometry is one path per key.
export const SILHOUETTE: Record<Shape, string> = {
  single: "M50,8 C54 8 56 13 56 20 L56 35 L93 38 Q96 38 96 41 L96 49 Q96 51 93 52 L58 54 C56 61 54 69 53 76 L68 81 L68 87 L53 85 L52 91 Q51 94 50 94 Q49 94 48 91 L47 85 L32 87 L32 81 L47 76 C46 69 44 61 42 54 L7 52 Q4 51 4 49 L4 41 Q4 38 7 38 L44 35 L44 20 C44 13 46 8 50 8 Z",
  twin: "M50,4 C54 4 56 10 56 17 L57 36 L67 38 L67 27 C67 23 69 21 72 21 C75 21 77 23 77 27 L77 39 L93 41 Q96 41 96 44 L96 50 Q96 52 93 53 L77 54 L76 59 Q72 63 68 59 L67 54 L57 55 L54 78 L71 84 L71 90 L53 88 L52 94 Q51 96 50 96 Q49 96 48 94 L47 88 L29 90 L29 84 L46 78 L43 55 L33 54 L32 59 Q28 63 24 59 L23 54 L7 53 Q4 52 4 50 L4 44 Q4 41 7 41 L23 39 L23 27 C23 23 25 21 28 21 C31 21 33 23 33 27 L33 38 L43 36 L44 17 C44 10 46 4 50 4 Z",
  jet: "M50,3 C53 5 55 11 55 19 L56 33 L92 54 Q94 55 94 57 L94 62 L56 49 L55 65 L61 65 L61 64 Q61 61 65 61 Q69 61 69 65 L69 76 Q69 79 65 79 L55 76 L54 82 L69 89 L69 94 L52 90 L50 97 L48 90 L31 94 L31 89 L46 82 L45 76 L35 79 Q31 79 31 76 L31 65 Q31 61 35 61 Q39 61 39 64 L39 65 L45 65 L44 49 L6 62 L6 57 Q6 55 8 54 L44 33 L45 19 C45 11 47 5 50 3 Z",
  airliner: "M50,3 C54 3 57 10 57 18 L57 34 L65 39 L65 33 Q65 29 69 29 Q73 29 73 33 L73 44 L94 58 L96 55 L98 56 L98 65 Q98 68 95 67 L73 57 L73 61 Q69 65 65 61 L65 54 L57 51 L56 78 L71 87 L71 93 L54 88 L52 96 Q51 98 50 98 Q49 98 48 96 L46 88 L29 93 L29 87 L44 78 L43 51 L35 54 L35 61 Q31 65 27 61 L27 57 L5 67 Q2 68 2 65 L2 56 L4 55 L6 58 L27 44 L27 33 Q27 29 31 29 Q35 29 35 33 L35 39 L43 34 L43 18 C43 10 46 3 50 3 Z",
  heli: "M50 7 A36 36 0 0 1 53 78.875 L53 87 L65 90 L65 94 L53 92 L52 97 L48 97 L47 92 L35 94 L35 90 L47 87 L47 78.875 A36 36 0 0 1 50 7 Z M50 12 A31 31 0 0 1 53 73.854 L53 58 C61 56 63 48 62 36 C61 28 56 23 50 23 C44 23 39 28 38 36 C37 48 39 56 47 58 L47 73.854 A31 31 0 0 1 50 12 Z",
};
```

## SVG use

Each string is the `d` attribute of a single path. Use this wrapper, replacing `PATH_STRING` and letting the application set `fill`:

```html
<svg viewBox="0 0 100 100" width="30" height="30">
  <path fill-rule="evenodd" d="PATH_STRING" />
</svg>
```

Do not put each helicopter subpath into a separate SVG element. Do not replace the rotor ring with a solid disc. Do not introduce a new group transform into the marker, since track rotation is already applied to the SVG itself.

## Selection issues to address separately

These issues were observed in `shapeFor()` while reading the current code. They are not fixed by replacing the drawing paths:

1. `PC12`, `TBM7`, `TBM8`, `TBM9`, `C208`, `C08T`, `KODI`, `M600`, `P46T`, `EPIC`, and `PC6` are currently included in `TWIN`. They are single-engine types, so the two nacelles in the new twin icon would be misleading. A dedicated single-turboprop class is a useful next addition; routing them to `single` is the available five-class alternative.
2. Categories `A3`, `A4` and `A5` are checked before the explicit `JET` designator set. Consequently a known business-jet type with one of these categories returns `airliner`. For type-specific icons, resolve known designators before using broad category fallbacks.
3. There is no explicit airliner designator set. A populated but unmatched type returns `single` before owner text is considered. This can mislabel known airliners when emitter-category data is missing. Add authoritative designator mapping rather than guessing from a blanket category or arbitrary prefixes.
4. The five classes deliberately simplify the fleet: a Vision Jet is not a conventional twin rear-engine business jet, a CRJ is not an underwing-engine airliner, and unusual twins such as the C337 differ from the representative twin planform. More specific silhouettes require additional keys and a mapping change; these five strings do not provide full ADS-B Exchange type coverage.

Keep these follow-up classification decisions separate from installing the five new paths so the artwork handoff does not silently alter live tracking behaviour.

## Verification performed

The exact exported paths were rendered to a 1000 × 1000 alpha mask and inspected in enlarged and actual-size previews. Bounds and left-right symmetry were checked from that raster. Values below are in 100-unit SVG coordinates; the centroid is the filled-area visual centre, not an aerodynamic centre of gravity.

| Key | Rendered bounds (x min, y min, x max, y max) | Filled-area centre |
|---|---|---|
| `single` | 4, 8, 96, 94 | (50, 48.8) |
| `twin` | 4, 4, 96, 96 | (50, 48.54) |
| `jet` | 6, 3, 94, 96.8 | (50, 55.52) |
| `airliner` | 2, 3, 98, 98 | (50, 52.56) |
| `heli` | 14, 7, 86, 97 | (50, 48.02) |

All five are centred horizontally; the largest vertical visual-centre offset is about 5.5 units (1.7 screen pixels at 30 px). Small raster edge differences between mirrored halves are below 0.1% of filled alpha. The helicopter's hollow ring and solid cabin were visually inspected. The exported SVG files were checked to contain exactly one path each.

After integration, inspect each marker on the actual map at north, east, south, west and diagonal headings. Confirm colour changes, rotation centre, pulse alignment and no layout clipping. Run the repository's applicable checks. This handoff does not claim that the live app was changed or browser-tested with the replacements.

## Reference sources

Reviewed on 2026-09-07:

- [ADS-B Exchange live map](https://globe.adsbexchange.com/) — visual reference for compact aircraft markers.
- [tar1090 marker definitions](https://github.com/wiedehopf/tar1090/blob/master/html/markers.js) — primary reference for the range of planforms and separate type-designator mapping. The Cessna, twin, airliner and helicopter families informed the comparison; the supplied geometry was newly drawn.
- [ADS-B Exchange Map Help](https://support.adsbexchange.com/hc/en-us/articles/44653064937741-Map-Help) — product reference.
