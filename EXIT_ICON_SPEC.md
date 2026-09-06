### exit — redraw

**Problem.** `exit` and `logout` currently share one drawing (a doorframe with an
arrow leaving it). They are different actions with different consequences, and
the shared mark makes the destructive one look routine.

| | |
|---|---|
| Name | `exit` (keep the name; do not merge into `logout`) |
| Grid | 24 × 24 |
| Sizes used | 15px |
| Call site | `components/hangar/hangar-grid.tsx:553` — a `danger`-marked row reading **"Leave aircraft"** in an aircraft tile's ⋮ menu |

**What the action is.** Someone an aircraft was *shared with* hands it back. It
leaves their hangar and they lose access until the owner grants it again. They
cannot undo it themselves. It is not signing out, not deleting, and not
revoking someone else's access.

**What the glyph should say.** Removing yourself from a thing that stays behind
— an arrow leaving a bounded shape, or a card with a figure stepping out of it.
The object remains; you are the one departing.

**Must not read as:**

- a doorway with an arrow through it — that is `logout`, which sits two menus
  away and means something reversible;
- a bin, lid or anything discarding — `trash` is the row directly beneath this
  one and deletes the aircraft outright;
- a figure being removed by someone else — `users` and `eye`, higher in the same
  menu, are about other people's access, not your own departure.

**Constraints.** Same wrapper as the rest of the set: `viewBox="0 0 24 24"`,
`fill="none"`, `stroke="currentColor"`, `stroke-width="1.7"` in user units,
round caps and joins. Single `<path>` if it can be done in one; it does not need
groups or per-element weights. It renders at 15px beside 13px text and is tinted
red by the menu row, so it must hold its shape at that size and read at a glance
against `trash` and `logout` in the same set.
