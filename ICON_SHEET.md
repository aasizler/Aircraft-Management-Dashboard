# AeroTrack icon sheet

Every glyph the app draws, with its exact geometry and the sizes it appears at.
Hand-drawn on a 24-unit grid — there is no icon library behind these.

## How they are drawn

One wrapper for all of them. Nothing is filled: every shape is a stroke, so a
glyph takes the colour of the text around it and needs no light/dark variant.

```html
<svg viewBox="0 0 24 24" width="{size}" height="{size}"
     fill="none" stroke="currentColor" stroke-width="1.7"
     stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
  <path d="{d}" />
</svg>
```

- **Grid** — 24 x 24, except `fleet`, which is 30 x 24. A wide glyph keeps the
  24 height and takes its width from the box: `width = size * boxWidth / 24`.
- **Stroke width** — 1.7 at every size, never scaled with the glyph. A 13px icon
  is therefore proportionally heavier than a 78px one, which is deliberate:
  thinning it at small sizes made the strokes vanish against the panels.
- **Caps and joins** — round, both. Several glyphs rely on it; `plane` and
  `fleet` have sharp points that miter into spikes without it.
- **Colour** — always `currentColor`, never set on the svg.
- **Default size** — 15px when the caller does not give one.

## Index

| Name | Grid | Sizes used | What it is |
|---|---|---|---|
| `sort` | 24 x 24 | 15 | Three descending rules with a down arrow — sort order. |
| `settings` | 24 x 24 | 15 | Cog with a centre bore. |
| `logout` | 24 x 24 | 15 | Door with an arrow leaving through it. |
| `users` | 24 x 24 | 15 | Two figures, one behind the other — people with access. |
| `eye` | 24 x 24 | 14, 15, 17 | Open eye — view, or watch. |
| `trash` | 24 x 24 | 15 | Bin with a lid and a handle. |
| `share` | 24 x 24 | 15 | Tray with an arrow rising out of it. |
| `pencil` | 24 x 24 | 15 | Pencil at 45 degrees, tip lower-left. |
| `inbox` | 24 x 24 | 13, 15, 16 | Tray with a notch in its lip — incoming invitations. |
| `exit` | 24 x 24 | 15 | Same drawing as logout; kept separate so either name reads right at its call site. |
| `eraser` | 24 x 24 | — | Eraser on a rule. |
| `power` | 24 x 24 | — | Power symbol — a broken ring over a stem. |
| `hangar` | 24 x 24 | 16, 17 | Pitched roof over an arched opening. Known problem: it reads as a house, not a hangar — a peaked roof above a doorway is the shape of a dwelling. Worth redrawing. |
| `plane` | 24 x 24 | 13, 15, 78 | A paper plane climbing to the upper right, with the fold crease drawn. |
| `fleet` | 30 x 24 | 15 | The `plane` glyph at 0.7 scale, twice, near enough line abreast — the wingman a short way out to one side and only a little behind. The one glyph on a 30-wide grid. |
| `landing` | 24 x 24 | 17 | An aeroplane in the flare over a runway line — a landing, or an arrival. |
| `signal` | 24 x 24 | 13, 17 | Four arcs radiating from a centre dot — broadcasting, used for a live ADS-B signal. |
| `alert` | 24 x 24 | 14, 15 | Triangle with a bang. |
| `grounded` | 24 x 24 | 14, 15, 17 | Circle with a slash — not airworthy. |
| `droplet` | 24 x 24 | 15 | A drop — oil added. |
| `wrench` | 24 x 24 | 14, 15 | Open-ended spanner at 45 degrees — maintenance, or an oil change. |
| `camera` | 24 x 24 | 15, 26 | Camera body with a lens. |
| `paperclip` | 24 x 24 | 13 | Paperclip — an attachment. |
| `check` | 24 x 24 | 14, 15 | A tick. |
| `cash` | 24 x 24 | 14, 15 | Banknote with a coin at its centre — a maintenance cost. |
| `calendar` | 24 x 24 | 13, 15 | Month grid with two binder rings. |
| `file` | 24 x 24 | 15 | Sheet with a folded corner and two rules — a document. |
| `shield` | 24 x 24 | 13, 14, 15 | Shield — airworthiness. |

Sizes are px. Where several are listed the glyph is drawn at each of them
somewhere in the app.

## Geometry

### sort

Three descending rules with a down arrow — sort order.

`viewBox="0 0 24 24"`

```
M4 6h10M4 12h7M4 18h4M17 8v10m0 0l-3-3m3 3l3-3
```

| Size | Where |
|---|---|
| 15px | `components/nav-menu.tsx:102` |

### settings

Cog with a centre bore.

`viewBox="0 0 24 24"`

```
M12 15a3 3 0 100-6 3 3 0 000 6zM19.4 15a1.7 1.7 0 00.3 1.9l.1.1a2 2 0 11-2.8 2.8l-.1-.1a1.7 1.7 0 00-2.9 1.2v.2a2 2 0 11-4 0v-.1a1.7 1.7 0 00-1.1-1.6 1.7 1.7 0 00-1.9.4l-.1.1a2 2 0 11-2.8-2.8l.1-.1a1.7 1.7 0 00-1.2-2.9h-.2a2 2 0 110-4h.1a1.7 1.7 0 001.6-1.1 1.7 1.7 0 00-.4-1.9l-.1-.1a2 2 0 112.8-2.8l.1.1a1.7 1.7 0 001.9.3h.1A1.7 1.7 0 0011 3.5v-.2a2 2 0 114 0v.1a1.7 1.7 0 001 1.6 1.7 1.7 0 001.9-.4l.1-.1a2 2 0 112.8 2.8l-.1.1a1.7 1.7 0 00-.3 1.9v.1a1.7 1.7 0 001.6 1H21a2 2 0 010 4h-.1a1.7 1.7 0 00-1.5 1z
```

| Size | Where |
|---|---|
| 15px | `components/nav-menu.tsx:88` |
| 15px | `components/nav-menu.tsx:109` |
| 15px | `components/hangar/hangar-grid.tsx:527` |

### logout

Door with an arrow leaving through it.

`viewBox="0 0 24 24"`

```
M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4M16 17l5-5-5-5M21 12H9
```

| Size | Where |
|---|---|
| 15px | `components/nav-menu.tsx:114` |

### users

Two figures, one behind the other — people with access.

`viewBox="0 0 24 24"`

```
M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2M9 11a4 4 0 100-8 4 4 0 000 8zM23 21v-2a4 4 0 00-3-3.9M16 3.1a4 4 0 010 7.8
```

| Size | Where |
|---|---|
| 15px | `components/aircraft/tabs/insurance.tsx:273` |
| 15px | `components/hangar/hangar-grid.tsx:536` |

### eye

Open eye — view, or watch.

`viewBox="0 0 24 24"`

```
M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8zM12 15a3 3 0 100-6 3 3 0 000 6z
```

| Size | Where |
|---|---|
| 17px | `components/aircraft/tabs/dashboard.tsx:172` |
| 15px | `components/aircraft/tabs/dashboard.tsx:52` |
| 15px | `components/hangar/hangar-grid.tsx:541` |
| 14px | `components/aircraft/tabs/dashboard.tsx:52` |

### trash

Bin with a lid and a handle.

`viewBox="0 0 24 24"`

```
M3 6h18M8 6V4a1 1 0 011-1h6a1 1 0 011 1v2m3 0v14a1 1 0 01-1 1H6a1 1 0 01-1-1V6
```

| Size | Where |
|---|---|
| 15px | `components/hangar/hangar-grid.tsx:435` |
| 15px | `components/hangar/hangar-grid.tsx:562` |

### share

Tray with an arrow rising out of it.

`viewBox="0 0 24 24"`

```
M4 12v8a1 1 0 001 1h14a1 1 0 001-1v-8M16 6l-4-4-4 4M12 2v14
```

| Size | Where |
|---|---|
| 15px | `components/hangar/hangar-grid.tsx:418` |

### pencil

Pencil at 45 degrees, tip lower-left.

`viewBox="0 0 24 24"`

```
M17 3a2.8 2.8 0 114 4L7.5 20.5 2 22l1.5-5.5L17 3z
```

| Size | Where |
|---|---|
| 15px | `components/hangar/hangar-grid.tsx:425` |

### inbox

Tray with a notch in its lip — incoming invitations.

`viewBox="0 0 24 24"`

```
M22 12h-6l-2 3h-4l-2-3H2M5.5 5.1L2 12v6a2 2 0 002 2h16a2 2 0 002-2v-6l-3.5-6.9A2 2 0 0016.8 4H7.2a2 2 0 00-1.7 1.1z
```

| Size | Where |
|---|---|
| 16px | `components/pending-invites.tsx:300` |
| 15px | `components/nav-menu.tsx:79` |
| 13px | `components/hangar/news-feed.tsx:49` |

### exit

Same drawing as logout; kept separate so either name reads right at its call site.

`viewBox="0 0 24 24"`

```
M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4M16 17l5-5-5-5M21 12H9
```

| Size | Where |
|---|---|
| 15px | `components/hangar/hangar-grid.tsx:553` |

### eraser

Eraser on a rule.

`viewBox="0 0 24 24"`

```
M4 15l7-7a2 2 0 013 0l4 4a2 2 0 010 3l-5 5H8l-4-4a2 2 0 010-1zM9 21h11
```

### power

Power symbol — a broken ring over a stem.

`viewBox="0 0 24 24"`

```
M12 3v9M18.4 6.6a9 9 0 11-12.8 0
```

### hangar

Pitched roof over an arched opening. Known problem: it reads as a house, not a hangar — a peaked roof above a doorway is the shape of a dwelling. Worth redrawing.

`viewBox="0 0 24 24"`

```
M2 21V11l10-6 10 6v10M2 21h20M8 21v-6a4 4 0 018 0v6
```

| Size | Where |
|---|---|
| 17px | `components/hangar/hangar-grid.tsx:452` |
| 16px | `components/nav-menu.tsx:56` |

### plane

A paper plane climbing to the upper right, with the fold crease drawn.

`viewBox="0 0 24 24"`

```
M22 2L11 13M22 2l-7 20-4-9-9-4 20-7z
```

| Size | Where |
|---|---|
| 78px | `components/hangar/hangar-grid.tsx:492` |
| 15px | `components/aircraft/tabs/flights.tsx:94` |
| 15px | `components/aircraft/tabs/dashboard.tsx:191` |
| 15px | `components/hangar/add-aircraft.tsx:248` |
| 13px | `components/aircraft/flight-map.tsx:729` |

### fleet

The `plane` glyph at 0.7 scale, twice, near enough line abreast — the wingman a short way out to one side and only a little behind. The one glyph on a 30-wide grid.

`viewBox="0 0 30 24"`

```
M28.86 9.03L21.16 16.73M28.86 9.03L23.96 23.03L21.16 16.73L14.86 13.93ZM15.14 0.97L7.44 8.67M15.14 0.97L10.24 14.97L7.44 8.67L1.14 5.87Z
```

| Size | Where |
|---|---|
| 15px | `components/hangar/new-fleet.tsx:49` |

### landing

An aeroplane in the flare over a runway line — a landing, or an arrival.

`viewBox="0 0 24 24"`

```
M3 21h18M6 16l13-2.6a2 2 0 10-1-3.7l-4 .8-5.5-4.6L7 6.3l3 4.9-3.6.7-2-2-1.2.3 1.6 4z
```

| Size | Where |
|---|---|
| 17px | `components/aircraft/live-banner.tsx:125` |

### signal

Four arcs radiating from a centre dot — broadcasting, used for a live ADS-B signal.

`viewBox="0 0 24 24"`

```
M4.9 19.1a10 10 0 010-14.2M7.8 16.2a6 6 0 010-8.4M16.2 7.8a6 6 0 010 8.4M19.1 4.9a10 10 0 010 14.2M12.5 12a.5.5 0 11-1 0 .5.5 0 011 0z
```

| Size | Where |
|---|---|
| 17px | `components/aircraft/live-banner.tsx:98` |
| 17px | `components/aircraft/live-banner.tsx:110` |
| 13px | `components/hangar/hangar-grid.tsx:617` |

### alert

Triangle with a bang.

`viewBox="0 0 24 24"`

```
M10.3 3.9L1.8 18a2 2 0 001.7 3h17a2 2 0 001.7-3L14.7 3.9a2 2 0 00-3.4 0zM12 9v4M12 17h.01
```

| Size | Where |
|---|---|
| 15px | `components/aircraft/tabs/dashboard.tsx:39` |
| 15px | `components/aircraft/tabs/dashboard.tsx:42` |
| 15px | `components/aircraft/tabs/dashboard.tsx:80` |
| 15px | `components/aircraft/tabs/dashboard.tsx:194` |
| 14px | `components/aircraft/publications.tsx:74` |
| 14px | `components/aircraft/publications.tsx:103` |
| 14px | `components/aircraft/tabs/dashboard.tsx:39` |
| 14px | `components/aircraft/tabs/dashboard.tsx:42` |
| 14px | `components/aircraft/tabs/dashboard.tsx:80` |

### grounded

Circle with a slash — not airworthy.

`viewBox="0 0 24 24"`

```
M12 21a9 9 0 100-18 9 9 0 000 18zM5.6 5.6l12.8 12.8
```

| Size | Where |
|---|---|
| 17px | `components/aircraft/tabs/dashboard.tsx:161` |
| 15px | `components/aircraft/tabs/dashboard.tsx:36` |
| 14px | `components/aircraft/tabs/dashboard.tsx:36` |

### droplet

A drop — oil added.

`viewBox="0 0 24 24"`

```
M12 2.7l5.7 5.7a8 8 0 11-11.4 0z
```

| Size | Where |
|---|---|
| 15px | `components/aircraft/tabs/dashboard.tsx:197` |

### wrench

Open-ended spanner at 45 degrees — maintenance, or an oil change.

`viewBox="0 0 24 24"`

```
M14.7 6.3a4 4 0 015.4 5.4l-1.4-1.4-2.6.7.7-2.6-2.1-2.1zM14.7 6.3L4.6 16.4a2 2 0 102.8 2.8L17.5 9.1
```

| Size | Where |
|---|---|
| 15px | `components/aircraft/tabs/dashboard.tsx:85` |
| 15px | `components/aircraft/tabs/dashboard.tsx:200` |
| 14px | `components/aircraft/tabs/dashboard.tsx:85` |

### camera

Camera body with a lens.

`viewBox="0 0 24 24"`

```
M23 19a2 2 0 01-2 2H3a2 2 0 01-2-2V8a2 2 0 012-2h4l2-3h6l2 3h4a2 2 0 012 2zM12 17a4 4 0 100-8 4 4 0 000 8z
```

| Size | Where |
|---|---|
| 26px | `components/aircraft/meter-capture.tsx:311` |
| 26px | `components/aircraft/receipt-scan.tsx:204` |
| 15px | `components/aircraft/meter-capture.tsx:294` |
| 15px | `components/aircraft/receipt-scan.tsx:190` |

### paperclip

Paperclip — an attachment.

`viewBox="0 0 24 24"`

```
M21.4 11.1l-9.2 9.2a6 6 0 01-8.5-8.5l9.2-9.2a4 4 0 015.7 5.7l-9.2 9.2a2 2 0 01-2.8-2.8l8.5-8.5
```

| Size | Where |
|---|---|
| 13px | `components/aircraft/tabs/squawks.tsx:226` |

### check

A tick.

`viewBox="0 0 24 24"`

```
M20 6L9 17l-5-5
```

| Size | Where |
|---|---|
| 15px | `components/aircraft/tabs/dashboard.tsx:54` |
| 14px | `components/aircraft/tabs/dashboard.tsx:54` |
| 14px | `components/hangar/ad-ribbon.tsx:152` |

### cash

Banknote with a coin at its centre — a maintenance cost.

`viewBox="0 0 24 24"`

```
M2 7h20v10H2zM12 14.5a2.5 2.5 0 100-5 2.5 2.5 0 000 5M6 7v10M18 7v10
```

| Size | Where |
|---|---|
| 15px | `components/aircraft/maint-costs.tsx:159` |
| 15px | `components/aircraft/tabs/dashboard.tsx:74` |
| 14px | `components/aircraft/tabs/dashboard.tsx:74` |

### calendar

Month grid with two binder rings.

`viewBox="0 0 24 24"`

```
M3 6a2 2 0 012-2h14a2 2 0 012 2v14a2 2 0 01-2 2H5a2 2 0 01-2-2zM3 10h18M8 2v4M16 2v4
```

| Size | Where |
|---|---|
| 15px | `components/aircraft/tabs/schedule.tsx:142` |
| 13px | `components/hangar/ad-ribbon.tsx:49` |

### file

Sheet with a folded corner and two rules — a document.

`viewBox="0 0 24 24"`

```
M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8zM14 2v6h6M9 13h6M9 17h6
```

| Size | Where |
|---|---|
| 15px | `components/aircraft/tabs/insurance.tsx:327` |
| 15px | `components/aircraft/tabs/documents.tsx:122` |

### shield

Shield — airworthiness.

`viewBox="0 0 24 24"`

```
M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z
```

| Size | Where |
|---|---|
| 15px | `components/aircraft/tabs/insurance.tsx:249` |
| 14px | `components/aircraft/publications.tsx:51` |
| 13px | `components/hangar/ad-ribbon.tsx:56` |
| 13px | `components/hangar/ad-ribbon.tsx:133` |

## Marks that are not glyphs

Four things read as symbols but are drawn in CSS, not SVG.

| Mark | Size | How it is drawn |
|---|---|---|
| Brand dot | 10px | Filled circle in the accent colour, left of the wordmark. |
| Status dot | 6px | Filled circle, coloured by state — green current, amber due, red overdue, grey untracked. |
| Overflow menu | 3 x 3px dots in a 26px hit area | Three circles stacked vertically, 3px gap. Grey at rest, white on hover. |
| Live pulse | 8px | Filled circle in #00e164, blinking on a 1.4s ease-in-out loop. Grey and still when the aircraft is on the ground. |

## Chart marks

| Mark | Size | How it is drawn |
|---|---|---|
| Sparkline | fills its container | A single `polyline`, stroke 1.5, round caps and joins, no fill. |
| Donut segment | square, caller-sized | `path` per segment, filled with the series colour and stroked 1.5 in the panel background so neighbours separate. |

## Colours the glyphs inherit

They never carry their own colour, but these are the tokens they land on:

| Token | Dark | Meaning |
|---|---|---|
| `--accent` | `#3b9eff` | Primary actions, links, live/tracked states |
| `--ok` | `#22e2a6` | Current, all clear |
| `--warn` | `#ffa023` | Due soon |
| `--danger` | `#ff4050` | Overdue, grounded |
| `--text` | `#f0f0f0` | Default foreground |
| `--muted2` | `#888` | Icons at rest inside buttons |
| `--muted3` | `#aaa` | Secondary marks |
