# AeroTrack icon sheet — implementation handoff

This document specifies the selected replacement icon set. It is an implementation target, not a claim that the application has already been updated. All 28 existing icon names remain available. The complete SVG geometry below is self-contained; no image files, external icon package, or previous conversation are required.

## Latest design direction

- Keep AeroTrack’s rounded outline style and inherited colours.
- Use the refined utility icons below, including actual aircraft outlines for `plane` and `fleet` instead of paper planes.
- **Camera:** retain the original broad body, spanning x=1 through x=23 on the 24-unit grid. Use the refined set’s rounded corners, centred lens and 1.7-unit stroke. Do not substitute the narrower first proposal.
- **Hangar:** use an arched hangar with the King Air–style twin turboprop inside. This revision softens the previously detailed drawing to fit the icon family: outline fuselage, no cockpit windows, no propeller hub rings, simple landing gear, small symmetrical winglets, a T-tail, and exactly five thin feathered blades on each propeller. Preserve the centre nose landing gear. Do not return to the house-shaped icon or the earlier bare hangar with a generic aircraft cross.
- The remaining 26 drawings are unchanged from the reviewed refinement set. The camera and hangar SVGs below incorporate the latest requested adjustments.

## Implementation target

The shared component inspected for this handoff is `web/components/ui/icon.tsx`. Its existing API is `Icon({ name, size = 15 })`; retain that API, the `IconName` names, `className="icon"`, inherited `currentColor`, and decorative `aria-hidden="true"` behaviour. Keep accessible labels on the surrounding controls.

The current implementation stores a single path string per name and renders one `<path>`. That is insufficient for the new `fleet` and `hangar`, which contain groups and multiple elements. Render typed SVG/JSX children for those two names, or use a typed geometry map for the full set. Do not paste SVG markup into a path’s `d` attribute. When translating the markup to JSX, use React attributes such as `strokeWidth`, `strokeLinecap`, and `strokeLinejoin`; preserve all geometry and group overrides.

The supplied SVGs contain only glyphs. The Hangar text, button background, border, padding and action behaviour remain separate application UI. No application source code was modified while preparing this document.

## Drawing rules

| Property | Specification |
|---|---|
| Standard viewBox | `0 0 24 24` |
| Fleet viewBox | `0 0 30 24` |
| Hangar viewBox | `0 0 48 24` |
| Rendered height | `size`, default 15 px |
| Rendered width | `size * viewBoxWidth / 24` |
| Fill | `none` |
| Stroke | `currentColor` |
| Standard stroke width | 1.7 SVG user units |
| Caps and joins | `round` |
| Hangar interior | 1.1-unit aircraft lines; 0.8-unit feathered propeller lines |

Use `fleet: 30` and `hangar: 48` in the wide-icon metadata. A hangar at height 16 px is 32 px wide; at 17 px it is 34 px wide. Preserve that ratio and check surrounding flex layouts for compression rather than forcing it into a square.

**Stroke scaling clarification:** `stroke-width="1.7"` is in SVG user units, not a fixed 1.7 screen pixels. With the supplied wrapper and no `vector-effect="non-scaling-stroke"`, it scales with the viewBox: a standard 15 px icon has a nominal 1.0625 px stroke. This corrects the old sheet’s “never scaled” wording. Preserve the reviewed scaling rather than introducing non-scaling strokes. Fleet’s internal 0.65 transforms also scale its strokes. Hangar’s explicit interior widths retain thinner feathered blades while its outer building matches the standard 1.7-unit outline.

The SVG blocks below omit display dimensions so the shared component can supply them. Keep each listed viewBox and all child attributes intact.

## Icon inventory

Sizes below were recorded in the original icon sheet. They are useful verification targets, not a fresh call-site audit.

| Name | New grid | Recorded sizes (px) | Design |
|---|---|---|---|
| `hangar` | 48 × 24 | 16, 17 | Softer outline version of the King Air hangar: matching outer line weight, round caps, five feathered blades, short winglets and simple landing gear. Cockpit windows, filled fuselage and hub rings removed. |
| `plane` | 24 × 24 | 13, 15, 78 | Replace the paper plane with an actual aircraft seen from above. |
| `fleet` | 30 × 24 | 15 | Two matching aircraft, separated enough to remain distinct. |
| `landing` | 24 × 24 | 17 | A clearer side profile descending toward a runway. |
| `signal` | 24 × 24 | 13, 17 | Preserve the broadcast symbol with more regular spacing. |
| `settings` | 24 × 24 | 15 | A regular eight-tooth cog with a calmer, balanced outline. |
| `users` | 24 × 24 | 15 | Inset the second figure so the group has breathing room. |
| `eye` | 24 × 24 | 14, 15, 17 | A softer almond shape with more consistent outer margins. |
| `sort` | 24 × 24 | 15 | More space between the ordering lines and arrow. |
| `logout` | 24 × 24 | 15 | Align the arrow with the door opening; keep the familiar meaning. |
| `exit` | 24 × 24 | 15 | An access card with a person stepping out through the corner. Distinct from `logout` — see EXIT_ICON_SPEC.md. |
| `share` | 24 × 24 | 15 | Retain the familiar share tray; balance arrow and container. |
| `inbox` | 24 × 24 | 13, 15, 16 | Simpler walls and a symmetrical receiving notch. |
| `pencil` | 24 × 24 | 15 | Separate the nib and end cap for a clearer pencil silhouette. |
| `trash` | 24 × 24 | 15 | A gently tapered bin and two simple internal ribs. |
| `wrench` | 24 × 24 | 14, 15 | A broader open jaw makes the maintenance tool easier to recognize. |
| `droplet` | 24 × 24 | 15 | A softer teardrop contour for oil added. |
| `cash` | 24 × 24 | 14, 15 | Replace full-height inner rules with quiet denomination marks. |
| `calendar` | 24 × 24 | 13, 15 | Add a sparse date grid; inspect it at 13 px before adopting. |
| `file` | 24 × 24 | 15 | Balance the folded corner and shorten the lower text rule. |
| `shield` | 24 × 24 | 13, 14, 15 | Retain the plain shield so it does not imply an extra verified status. |
| `alert` | 24 × 24 | 14, 15 | Keep the warning triangle; balance its margins and exclamation. |
| `grounded` | 24 × 24 | 14, 15, 17 | Keep this familiar prohibition symbol; extra aircraft detail would crowd it. |
| `check` | 24 × 24 | 14, 15 | A light optical adjustment; the existing shape already works. |
| `camera` | 24 × 24 | 15, 26 | Restore the original wide body (x=1 to 23), with rounded corners, a centered lens, and the shared 1.7-unit stroke. |
| `paperclip` | 24 × 24 | 13 | Open up the nested bends so the attachment mark feels less tangled. |
| `eraser` | 24 × 24 | — | A clear diagonal seam and a separate baseline. |
| `power` | 24 × 24 | — | Keep the familiar symbol; slightly reduce its visual footprint. |

## Complete replacement geometry

These SVG blocks are the canonical implementation geometry for this revision.

### hangar

Softer outline version of the King Air hangar: matching outer line weight, round caps, five feathered blades, short winglets and simple landing gear. Cockpit windows, filled fuselage and hub rings removed.

```svg
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round">
  <path d="M2 22V9Q24-5 46 9v13h-3V10.5H5V22Z" />
  <g stroke-width="1.1">
    <path d="M24 13v3.5M21.5 13.5h5M9 17l.6 1.3 12.8.9M25.6 19.2l12.8-.9L39 17" />
    <ellipse cx="24" cy="18.3" rx="1.6" ry="1.8" />
    <path d="M24 20.1v1.7M17 19.5v1.8M31 19.5v1.8" />
  </g>
  <g stroke-width=".8">
    <path d="M17 18.3L17.00 15.80" />
    <path d="M17 18.3L19.38 17.53" />
    <path d="M17 18.3L18.47 20.32" />
    <path d="M17 18.3L15.53 20.32" />
    <path d="M17 18.3L14.62 17.53" />
    <path d="M31 18.3L31.00 15.80" />
    <path d="M31 18.3L33.38 17.53" />
    <path d="M31 18.3L32.47 20.32" />
    <path d="M31 18.3L29.53 20.32" />
    <path d="M31 18.3L28.62 17.53" />
  </g>
</svg>
```

Recorded call sites from the original sheet (paths relative to `web/`; line numbers may move):

- 17px: `components/hangar/hangar-grid.tsx:452`
- 16px: `components/nav-menu.tsx:56`

### plane

Replace the paper plane with an actual aircraft seen from above.

```svg
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round">
  <path d="M12 2.5c-.8 0-1.4 1-1.4 2.2v4.5L3 13v2l7.6-2v5l-2.8 2v1l4.2-1 4.2 1v-1l-2.8-2v-5l7.6 2v-2l-7.6-3.8V4.7c0-1.2-.6-2.2-1.4-2.2Z" />
</svg>
```

Recorded call sites from the original sheet (paths relative to `web/`; line numbers may move):

- 78px: `components/hangar/hangar-grid.tsx:492`
- 15px: `components/aircraft/tabs/flights.tsx:94`
- 15px: `components/aircraft/tabs/dashboard.tsx:191`
- 15px: `components/hangar/add-aircraft.tsx:248`
- 13px: `components/aircraft/flight-map.tsx:729`

### fleet

Two matching aircraft, separated enough to remain distinct.

```svg
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 30 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round">
  <g transform="translate(0 0) scale(.65)">
    <path d="M12 2.5c-.8 0-1.4 1-1.4 2.2v4.5L3 13v2l7.6-2v5l-2.8 2v1l4.2-1 4.2 1v-1l-2.8-2v-5l7.6 2v-2l-7.6-3.8V4.7c0-1.2-.6-2.2-1.4-2.2Z" />
  </g>
  <g transform="translate(13 8) scale(.65)">
    <path d="M12 2.5c-.8 0-1.4 1-1.4 2.2v4.5L3 13v2l7.6-2v5l-2.8 2v1l4.2-1 4.2 1v-1l-2.8-2v-5l7.6 2v-2l-7.6-3.8V4.7c0-1.2-.6-2.2-1.4-2.2Z" />
  </g>
</svg>
```

Recorded call sites from the original sheet (paths relative to `web/`; line numbers may move):

- 15px: `components/hangar/new-fleet.tsx:49`

### landing

A clearer side profile descending toward a runway.

```svg
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round">
  <path d="M3 21h18M3.5 13.5l2.5 2 13.5 2a1.8 1.8 0 0 0 .5-3.6l-4.8-.8-5.2-6.6-2-.3 2.7 6.1-3.7-.6-2.5-3-1.5-.2.5 5Z" />
</svg>
```

Recorded call sites from the original sheet (paths relative to `web/`; line numbers may move):

- 17px: `components/aircraft/live-banner.tsx:125`

### signal

Preserve the broadcast symbol with more regular spacing.

```svg
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round">
  <path d="M5 5a10 10 0 0 0 0 14M8 8a5.7 5.7 0 0 0 0 8M16 8a5.7 5.7 0 0 1 0 8M19 5a10 10 0 0 1 0 14M13 12a1 1 0 1 1-2 0 1 1 0 0 1 2 0Z" />
</svg>
```

Recorded call sites from the original sheet (paths relative to `web/`; line numbers may move):

- 17px: `components/aircraft/live-banner.tsx:98`
- 17px: `components/aircraft/live-banner.tsx:110`
- 13px: `components/hangar/hangar-grid.tsx:617`

### settings

A regular eight-tooth cog with a calmer, balanced outline.

```svg
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round">
  <path d="M19.14 10.48L21.36 10.35L21.36 13.65L19.14 13.52L18.12 15.98L19.78 17.45L17.45 19.78L15.98 18.12L13.52 19.14L13.65 21.36L10.35 21.36L10.48 19.14L8.02 18.12L6.55 19.78L4.22 17.45L5.88 15.98L4.86 13.52L2.64 13.65L2.64 10.35L4.86 10.48L5.88 8.02L4.22 6.55L6.55 4.22L8.02 5.88L10.48 4.86L10.35 2.64L13.65 2.64L13.52 4.86L15.98 5.88L17.45 4.22L19.78 6.55L18.12 8.02ZM15 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z" />
</svg>
```

Recorded call sites from the original sheet (paths relative to `web/`; line numbers may move):

- 15px: `components/nav-menu.tsx:88`
- 15px: `components/nav-menu.tsx:109`
- 15px: `components/hangar/hangar-grid.tsx:527`

### users

Inset the second figure so the group has breathing room.

```svg
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round">
  <path d="M13 7a3.5 3.5 0 1 1-7 0 3.5 3.5 0 0 1 7 0ZM3 20v-2a5 5 0 0 1 5-5h3a5 5 0 0 1 5 5v2M17 4a3.5 3.5 0 0 1 0 7M19 14a4 4 0 0 1 2 3.5V20" />
</svg>
```

Recorded call sites from the original sheet (paths relative to `web/`; line numbers may move):

- 15px: `components/aircraft/tabs/insurance.tsx:273`
- 15px: `components/hangar/hangar-grid.tsx:536`

### eye

A softer almond shape with more consistent outer margins.

```svg
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round">
  <path d="M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12ZM15 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z" />
</svg>
```

Recorded call sites from the original sheet (paths relative to `web/`; line numbers may move):

- 17px: `components/aircraft/tabs/dashboard.tsx:172`
- 15px: `components/aircraft/tabs/dashboard.tsx:52`
- 15px: `components/hangar/hangar-grid.tsx:541`
- 14px: `components/aircraft/tabs/dashboard.tsx:52`

### sort

More space between the ordering lines and arrow.

```svg
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round">
  <path d="M3.5 6h10M3.5 12h7M3.5 18h4M18 5v14m-3-3 3 3 3-3" />
</svg>
```

Recorded call sites from the original sheet (paths relative to `web/`; line numbers may move):

- 15px: `components/nav-menu.tsx:102`

### logout

Align the arrow with the door opening; keep the familiar meaning.

```svg
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round">
  <path d="M9 3.5H5a1.5 1.5 0 0 0-1.5 1.5v14A1.5 1.5 0 0 0 5 20.5h4M10 12h10.5m-4-4 4 4-4 4" />
</svg>
```

Recorded call sites from the original sheet (paths relative to `web/`; line numbers may move):

- 15px: `components/nav-menu.tsx:114`

### exit

An access card with a person stepping out through the upper-right corner: the card stays, you leave. Deliberately not the `logout` doorway — this is the danger row that hands back a share you cannot restore yourself. Approved geometry recorded in EXIT_ICON_SPEC.md.

```svg
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round">
  <path d="M12 4H4.5A2 2 0 0 0 2.5 6v13a2 2 0 0 0 2 2h13a2 2 0 0 0 2-2v-6M13 10a2 2 0 1 1-4 0 2 2 0 0 1 4 0ZM7.5 17v-.5A3.5 3.5 0 0 1 11 13h0a3.5 3.5 0 0 1 3.5 3.5v.5M15.5 8.5 21 3m-5 0h5v5" />
</svg>
```

Recorded call sites from the original sheet (paths relative to `web/`; line numbers may move):

- 15px: `components/hangar/hangar-grid.tsx:553`

### share

Retain the familiar share tray; balance arrow and container.

```svg
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round">
  <path d="M4 12v7a1.5 1.5 0 0 0 1.5 1.5h13A1.5 1.5 0 0 0 20 19v-7M12 15V3m-4 4 4-4 4 4" />
</svg>
```

Recorded call sites from the original sheet (paths relative to `web/`; line numbers may move):

- 15px: `components/hangar/hangar-grid.tsx:418`

### inbox

Simpler walls and a symmetrical receiving notch.

```svg
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round">
  <path d="M3 13l3-8h12l3 8v6a1.5 1.5 0 0 1-1.5 1.5h-15A1.5 1.5 0 0 1 3 19v-6ZM3 13h5l2 3h4l2-3h5" />
</svg>
```

Recorded call sites from the original sheet (paths relative to `web/`; line numbers may move):

- 16px: `components/pending-invites.tsx:300`
- 15px: `components/nav-menu.tsx:79`
- 13px: `components/hangar/news-feed.tsx:49`

### pencil

Separate the nib and end cap for a clearer pencil silhouette.

```svg
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round">
  <path d="M15.5 4.5a2.8 2.8 0 0 1 4 4L8 20l-5 1 1-5L15.5 4.5ZM13.5 6.5l4 4M4 16l4 4" />
</svg>
```

Recorded call sites from the original sheet (paths relative to `web/`; line numbers may move):

- 15px: `components/hangar/hangar-grid.tsx:425`

### trash

A gently tapered bin and two simple internal ribs.

```svg
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round">
  <path d="M3.5 6h17M8.5 6V3.5h7V6M5.5 6l.7 13a1.5 1.5 0 0 0 1.5 1.5h8.6a1.5 1.5 0 0 0 1.5-1.5l.7-13M10 10v6.5M14 10v6.5" />
</svg>
```

Recorded call sites from the original sheet (paths relative to `web/`; line numbers may move):

- 15px: `components/hangar/hangar-grid.tsx:435`
- 15px: `components/hangar/hangar-grid.tsx:562`

### wrench

A broader open jaw makes the maintenance tool easier to recognize.

```svg
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round">
  <path d="M14 4a5.5 5.5 0 0 0-6.5 7L3.8 15.7a3 3 0 0 0 4.3 4.2l4.7-4.7A5.5 5.5 0 0 0 20 8l-3.5 3-3-1-1-3L16 3.5" />
</svg>
```

Recorded call sites from the original sheet (paths relative to `web/`; line numbers may move):

- 15px: `components/aircraft/tabs/dashboard.tsx:85`
- 15px: `components/aircraft/tabs/dashboard.tsx:200`
- 14px: `components/aircraft/tabs/dashboard.tsx:85`

### droplet

A softer teardrop contour for oil added.

```svg
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round">
  <path d="M12 3C10 6 5 10.6 5 14a7 7 0 0 0 14 0c0-3.4-5-8-7-11Z" />
</svg>
```

Recorded call sites from the original sheet (paths relative to `web/`; line numbers may move):

- 15px: `components/aircraft/tabs/dashboard.tsx:197`

### cash

Replace full-height inner rules with quiet denomination marks.

```svg
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round">
  <path d="M3 6h18v12H3ZM14.5 12a2.5 2.5 0 1 1-5 0 2.5 2.5 0 0 1 5 0ZM6 12h.01M18 12h.01" />
</svg>
```

Recorded call sites from the original sheet (paths relative to `web/`; line numbers may move):

- 15px: `components/aircraft/maint-costs.tsx:159`
- 15px: `components/aircraft/tabs/dashboard.tsx:74`
- 14px: `components/aircraft/tabs/dashboard.tsx:74`

### calendar

Add a sparse date grid; inspect it at 13 px before adopting.

```svg
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round">
  <path d="M5 5h14a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2ZM8 3v4M16 3v4M3 10h18M8 14h.01M12 14h.01M16 14h.01M8 17.5h.01M12 17.5h.01" />
</svg>
```

Recorded call sites from the original sheet (paths relative to `web/`; line numbers may move):

- 15px: `components/aircraft/tabs/schedule.tsx:142`
- 13px: `components/hangar/ad-ribbon.tsx:49`

### file

Balance the folded corner and shorten the lower text rule.

```svg
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round">
  <path d="M13.5 3H6a1.5 1.5 0 0 0-1.5 1.5v15A1.5 1.5 0 0 0 6 21h12a1.5 1.5 0 0 0 1.5-1.5v-10l-6-6ZM13.5 3v6h6M8.5 13h7M8.5 17h5" />
</svg>
```

Recorded call sites from the original sheet (paths relative to `web/`; line numbers may move):

- 15px: `components/aircraft/tabs/insurance.tsx:327`
- 15px: `components/aircraft/tabs/documents.tsx:122`

### shield

Retain the plain shield so it does not imply an extra verified status.

```svg
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round">
  <path d="M12 3l8 3v5c0 5-3.5 8-8 10-4.5-2-8-5-8-10V6l8-3Z" />
</svg>
```

Recorded call sites from the original sheet (paths relative to `web/`; line numbers may move):

- 15px: `components/aircraft/tabs/insurance.tsx:249`
- 14px: `components/aircraft/publications.tsx:51`
- 13px: `components/hangar/ad-ribbon.tsx:56`
- 13px: `components/hangar/ad-ribbon.tsx:133`

### alert

Keep the warning triangle; balance its margins and exclamation.

```svg
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round">
  <path d="M10.7 4a1.5 1.5 0 0 1 2.6 0l8 14a1.5 1.5 0 0 1-1.3 2.3H4a1.5 1.5 0 0 1-1.3-2.3l8-14ZM12 9v4.5M12 17h.01" />
</svg>
```

Recorded call sites from the original sheet (paths relative to `web/`; line numbers may move):

- 15px: `components/aircraft/tabs/dashboard.tsx:39`
- 15px: `components/aircraft/tabs/dashboard.tsx:42`
- 15px: `components/aircraft/tabs/dashboard.tsx:80`
- 15px: `components/aircraft/tabs/dashboard.tsx:194`
- 14px: `components/aircraft/publications.tsx:74`
- 14px: `components/aircraft/publications.tsx:103`
- 14px: `components/aircraft/tabs/dashboard.tsx:39`
- 14px: `components/aircraft/tabs/dashboard.tsx:42`
- 14px: `components/aircraft/tabs/dashboard.tsx:80`

### grounded

Keep this familiar prohibition symbol; extra aircraft detail would crowd it.

```svg
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round">
  <path d="M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0ZM5.6 5.6l12.8 12.8" />
</svg>
```

Recorded call sites from the original sheet (paths relative to `web/`; line numbers may move):

- 17px: `components/aircraft/tabs/dashboard.tsx:161`
- 15px: `components/aircraft/tabs/dashboard.tsx:36`
- 14px: `components/aircraft/tabs/dashboard.tsx:36`

### check

A light optical adjustment; the existing shape already works.

```svg
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round">
  <path d="M4 12.5l5 5L20 6.5" />
</svg>
```

Recorded call sites from the original sheet (paths relative to `web/`; line numbers may move):

- 15px: `components/aircraft/tabs/dashboard.tsx:54`
- 14px: `components/aircraft/tabs/dashboard.tsx:54`
- 14px: `components/hangar/ad-ribbon.tsx:152`

### camera

Restore the original wide body (x=1 to 23), with rounded corners, a centered lens, and the shared 1.7-unit stroke.

```svg
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round">
  <path d="M7 6l2-3h6l2 3h4a2 2 0 0 1 2 2v11a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4ZM16 13.5a4 4 0 1 1-8 0 4 4 0 0 1 8 0Z" />
</svg>
```

Recorded call sites from the original sheet (paths relative to `web/`; line numbers may move):

- 26px: `components/aircraft/meter-capture.tsx:311`
- 26px: `components/aircraft/receipt-scan.tsx:204`
- 15px: `components/aircraft/meter-capture.tsx:294`
- 15px: `components/aircraft/receipt-scan.tsx:190`

### paperclip

Open up the nested bends so the attachment mark feels less tangled.

```svg
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round">
  <path d="M9 16l7-7a2.1 2.1 0 0 0-3-3l-8 8a4.2 4.2 0 0 0 6 6l9-9a6 6 0 0 0-8.5-8.5L3 11" />
</svg>
```

Recorded call sites from the original sheet (paths relative to `web/`; line numbers may move):

- 13px: `components/aircraft/tabs/squawks.tsx:226`

### eraser

A clear diagonal seam and a separate baseline.

```svg
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round">
  <path d="M4 13.5l9-9a2 2 0 0 1 2.8 0l4.7 4.7a2 2 0 0 1 0 2.8l-8 8H8l-4-3.7a2 2 0 0 1 0-2.8ZM9 8.5l7.5 7.5M12.5 20H21" />
</svg>
```

### power

Keep the familiar symbol; slightly reduce its visual footprint.

```svg
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round">
  <path d="M12 3v9M6.3 5.7a8.5 8.5 0 1 0 11.4 0" />
</svg>
```

## Verification after implementation

1. Confirm every existing `IconName` still renders, including the currently unused `eraser` and `power` names. `logout` and `exit` are no longer the same drawing.
2. Inspect icons at their recorded 13–17 px usage sizes, camera at 26 px, and aircraft at 78 px. Check contrast, clipping, optical alignment and button spacing in the app’s actual themes.
3. Check the 30-unit fleet and 48-unit hangar widths in navigation and buttons. Keep both aircraft in Fleet visible without overlap from layout compression.
4. Confirm camera retains its original wider proportions. Confirm hangar has the arched roof, small symmetric winglets, five feathered blades per propeller, simple nose gear, no cockpit-window detail and no large filled fuselage.
5. Ensure all strokes inherit the surrounding text/status colour. Do not hard-code blue into the SVGs, bake button text into an image, or replace the SVGs with the earlier generated raster mockups.
6. Run the repository’s applicable type, lint and build checks after changing the renderer. The concept package’s SVG XML was checked; application rendering and integration still need verification.

## Existing non-glyph marks — preserve

Four things read as symbols but are drawn in CSS, not SVG.

| Mark | Size | How it is drawn |
|---|---|---|
| Brand dot | 10px | Filled circle in the accent colour, left of the wordmark. |
| Status dot | 6px | Filled circle, coloured by state — green current, amber due, red overdue, grey untracked. |
| Overflow menu | 3 x 3px dots in a 26px hit area | Three circles stacked vertically, 3px gap. Grey at rest, white on hover. |
| Live pulse | 8px | Filled circle in #00e164, blinking on a 1.4s ease-in-out loop. Grey and still when the aircraft is on the ground. |

## Existing chart marks — preserve

| Mark | Size | How it is drawn |
|---|---|---|
| Sparkline | fills its container | A single `polyline`, stroke 1.5, round caps and joins, no fill. |
| Donut segment | square, caller-sized | `path` per segment, filled with the series colour and stroked 1.5 in the panel background so neighbours separate. |

## Existing colour tokens — preserve

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
