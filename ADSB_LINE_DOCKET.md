# ADS-B line — docket

Observations from the hero/ADS-B work on 5 Sep 2026. Nothing here is done.

## 1. Three pollers for one registration — FIXED 5 Sep

`useLivePosition` polls every 10s per mount, and the page had grown three for
the same tail — the hero's location, the live row, the dashboard's airborne chip
— with a fourth arriving whenever the map opened. Four mounts is 24 requests a
minute for one aeroplane.

`detail-client` now polls once and puts `{status, state, track}` on
`AircraftCtx`; the row, the chip and the map read it. The landing handler is
registered by the live row through `onLanding`, since it is the only consumer
that wants one. One call site remains, at `detail-client.tsx:248`.

Still to confirm against a signed-in session: one request per 10s in the network
panel, and that the landing prompt still fires on an airborne-to-ground
transition. Neither could be exercised here.

## 2. The airport resolves a beat after the page

`useWhere` shows the base on file until the multi-megabyte airport database
loads, then swaps to the nearest field. On a slow connection the hero visibly
changes from grey `KPIE` to white `KSRQ` after a pause. Options: hold the slot
until it resolves, or accept the swap and make it less abrupt.

## 3. "Searching…" flashes on every load

The first poll has not returned, so every visit shows a searching row for a
second before settling. It is a state almost nobody needs to see. Consider
holding the previous state, or rendering nothing until the first result.

## 4. The row is a full-width banner for a non-event

"No live signal" is the normal condition for most of the fleet, and it takes the
same height and prominence as an aircraft actually being airborne. Worth asking
whether the quiet states should collapse to a single line.

## 5. The sync pill rides inside the live container

When airborne the row turns green and carries altitude, speed, heading and V/S —
and the Synced pill and Updated stamp sit inside that same coloured box. One row
doing two unrelated jobs. Flagged when it shipped; may be fine, may want the
stamp somewhere calmer.

## Yours

- 
