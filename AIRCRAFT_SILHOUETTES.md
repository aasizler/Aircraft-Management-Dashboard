# Aircraft silhouettes — spec for redrawing

These are the five top-down aircraft shapes AeroTrack draws as the live
marker on the flight map. They live in `web/lib/silhouettes.ts` as one SVG
path each. The current paths are placeholders drawn quickly; please redraw
them to the spec below and hand back the five `d` strings.

## Hard constraints (the code depends on these)

- **Canvas:** `viewBox="0 0 100 100"`. Draw inside 2–98 on both axes.
- **Orientation:** nose pointing straight **up** (toward y = 0). The app
  rotates the whole SVG by the aircraft's track, so the drawing itself must
  be exactly north-up and left-right symmetric about x = 50.
- **One `<path d="…">` per shape.** A single filled silhouette, no strokes,
  no gradients, no groups. Use `fill-rule="evenodd"` if you need a hole (the
  helicopter's rotor ring is drawn this way today).
- **Solid fill only.** The app sets the fill colour at runtime (accent blue
  airborne, grey on the ground) and draws a pulsing ring behind it, so do not
  bake in any colour, outline, or shadow.
- **Rendered size:** 30 × 30 px on screen (34 for the airliner). Detail finer
  than about 3 units in the 100-unit box will not survive. Keep silhouettes
  bold: wide wings, thick fuselage, no thin lines.
- **Visual centre:** the aircraft's centre of mass should sit close to
  (50, 50), since the marker is anchored at the centre of the box and the
  ring is drawn around that point.

## The five shapes

| key | Represents | What to draw |
|---|---|---|
| `single` | Piston single: Cirrus SR20/22, Cessna 172/182, Bonanza, Piper PA-28, RV-12 | Straight wing, single nose engine, conventional tail. This is the classic "top-down GA aeroplane" glyph. |
| `twin` | Piston or turboprop twin: Baron, Seneca, King Air, Cessna 310/414, PC-12/TBM also use this today | Same planform as the single with a nacelle on each wing, nacelles projecting ahead of the leading edge. Slightly longer fuselage than the single. |
| `jet` | Business jet: Vision Jet, Citation, Phenom, Learjet, Gulfstream, Challenger, Falcon | Swept wing, engines mounted on the rear fuselage, T-tail (a wider horizontal tail high on the fin, reading as a T from above). Pointed nose. |
| `airliner` | Transport category: 737, A320, CRJ, E-Jet | Swept wing with one engine pod under each wing, longer fuselage, swept horizontal tail at the rear. Reads bigger than the jet. |
| `heli` | Helicopter: Robinson R44/R66, Bell 407, Airbus H125/H135 | Cabin with a tail boom, and the main rotor as a thin ring (disc) centred on the cabin, tail rotor optional. The ring should be clearly a circle around the body, not a solid disc. |

## Current paths, for reference

```
single:   M50,2 C46,2 44,5 44,14 L41,36 L4,54 L4,63 L41,55 L42,74 L32,79 L32,86 L50,81 L68,86 L68,79 L58,74 L59,55 L96,63 L96,54 L59,36 L56,14 C56,5 54,2 50,2Z
twin:     M50,2 C46,2 44,5 44,14 L41,36 L30,40 L30,30 C30,26 25,26 25,30 L25,42 L4,54 L4,63 L25,58 L25,64 C25,68 30,68 30,64 L30,57 L41,55 L42,74 L32,79 L32,86 L50,81 L68,86 L68,79 L58,74 L59,55 L70,57 L70,64 C70,68 75,68 75,64 L75,58 L96,63 L96,54 L75,42 L75,30 C75,26 70,26 70,30 L70,40 L59,36 L56,14 C56,5 54,2 50,2Z
jet:      M50,2 C47,2 45,6 45,16 L44,42 L8,66 L8,72 L44,58 L44,72 L38,74 L38,80 L44,79 L44,84 L30,88 L30,93 L50,90 L70,93 L70,88 L56,84 L56,79 L62,80 L62,74 L56,72 L56,58 L92,72 L92,66 L56,42 L55,16 C55,6 53,2 50,2Z
airliner: M50,1 C46,1 44,5 44,14 L43,38 L28,46 L28,36 C28,32 22,32 22,36 L22,49 L3,60 L3,66 L22,61 L22,66 C22,70 28,70 28,66 L28,60 L43,56 L43,78 L32,86 L32,92 L50,88 L68,92 L68,86 L57,78 L57,56 L72,60 L72,66 C72,70 78,70 78,66 L78,61 L97,66 L97,60 L78,49 L78,36 C78,32 72,32 72,36 L72,46 L57,38 L56,14 C56,5 54,1 50,1Z
heli:     M50,22 C42,22 38,28 38,36 L38,50 C38,56 42,60 47,60 L47,84 L36,88 L36,92 L64,92 L64,88 L53,84 L53,60 C58,60 62,56 62,50 L62,36 C62,28 58,22 50,22Z M50,5 A36,36 0 1,0 50.01,5Z M50,9 A32,32 0 1,1 49.99,9Z
```

## Reference look

The style to match is the aircraft icons on globe.adsbexchange.com: flat,
solid, slightly chunky silhouettes that stay readable at 30 px. Theirs are
drawn in the same north-up convention.

## Deliverable

Five `d` strings, one per key, each a single closed path fitting the
constraints above. Paste them into `SILHOUETTE` in `web/lib/silhouettes.ts`,
or hand them back and they will be dropped in.
