# Exit icon — approved implementation specification

## Scope and precedence

Replace only the `exit` glyph with the approved geometry below. Keep the name `exit`; do not merge it into `logout`. This specification supersedes the `exit` geometry and the statement that `exit` and `logout` share a drawing in `ICON_SHEET.md`. All other icon definitions remain unchanged.

The design is approved. This document is a handoff for implementation; rewriting it does not modify the application component.

## Action and context

`exit` appears beside **Leave aircraft** in an aircraft tile’s overflow menu, on a `danger`-marked row. The recorded call site is `web/components/hangar/hangar-grid.tsx:553` (line numbers may move). The icon renders at 15 px beside 13 px text and inherits red from the menu row.

The action lets someone an aircraft was shared with give up their own access. The aircraft stays with its owner, while it leaves the departing user’s hangar. The user cannot restore access themselves; the owner must grant it again. This is not signing out, deleting the aircraft, or revoking another person’s access. Preserve the existing action, label and confirmation explaining loss of access.

## Approved design

An access card contains one person, with an arrow pointing outward through the upper-right corner. The card remains behind.

The final user-approved adjustments are part of the design:

- Centre the person horizontally inside the card: centre x=11, midway between card sides x=2.5 and x=19.5.
- Keep a clear gap between the person and the arrow. The arrow shaft starts at (15.5, 8.5) and ends at (21, 3). Do not lengthen it back toward the head or shoulder.
- Keep the outward arrowhead, rounded card corners and soft outline style.
- Preserve the visual distinction from the door-and-arrow `logout` icon, the `trash` bin, and access-management `users` / `eye` icons. Do not add a minus sign or a second person.

Retain the visible **Leave aircraft** label: the symbol alone cannot convey the access consequence.

## Rendering contract

| Property | Value |
|---|---|
| Name | `exit` |
| viewBox | `0 0 24 24` |
| Rendered size | 15 × 15 px at the recorded call site |
| Fill | `none` |
| Stroke | `currentColor` |
| Stroke width | 1.7 SVG user units |
| Line caps and joins | `round` |
| Geometry | One `<path>`; no groups, transforms, fills or per-element stroke overrides |
| Accessibility | Keep the existing decorative `aria-hidden="true"` wrapper and the surrounding control’s label |

The 1.7-unit stroke scales normally with the viewBox. Do not introduce non-scaling strokes or hard-code red into the glyph.

## Canonical SVG

Use this geometry exactly; it includes both the centred person and the shortened arrow.

```svg
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
  <path d="M12 4H4.5A2 2 0 0 0 2.5 6v13a2 2 0 0 0 2 2h13a2 2 0 0 0 2-2v-6M13 10a2 2 0 1 1-4 0 2 2 0 0 1 4 0ZM7.5 17v-.5A3.5 3.5 0 0 1 11 13h0a3.5 3.5 0 0 1 3.5 3.5v.5M15.5 8.5 21 3m-5 0h5v5"/>
</svg>
```

## Implementation

In `web/components/ui/icon.tsx`, replace only the `exit` entry’s path with the `d` value above. Keep the existing shared `Icon` wrapper and API. For JSX, use the existing `strokeWidth`, `strokeLinecap` and `strokeLinejoin` attributes on that wrapper. Update any comment saying `exit` uses the same geometry as `logout`.

Do not change `logout`, `trash`, other icons, menu permissions, action handlers, confirmation text, button styling or navigation. No new library or raster asset is needed.

If maintaining the main `ICON_SHEET.md`, update its `exit` section and shared-geometry statement to match this specification.

## Verification

- The supplied SVG parses and uses one path with the required wrapper attributes.
- After integration, inspect at 15 px in the actual danger row and enlarged to confirm the person remains centred and the arrow stays visibly separate.
- Compare against `logout` and `trash`; verify they retain their existing drawings.
- Confirm **Leave aircraft** still opens the existing loss-of-access confirmation and does not become a logout or delete action.
- Run the repository’s applicable checks for the component change. Application integration has not been performed as part of this design handoff.
