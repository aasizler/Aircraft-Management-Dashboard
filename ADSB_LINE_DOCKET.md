# ADS-B line — docket

Observations from the hero/ADS-B work on 5 Sep 2026. Nothing here is done.

## 1. Three pollers for one registration — REGRESSION, not an improvement

`useLivePosition` polls every 10s. On an aircraft detail page with the
Dashboard tab open it is now mounted three times for the same tail:

| Caller | Why |
|---|---|
| `components/aircraft/detail-client.tsx:243` | `useWhere`, for the hero's location — **added 5 Sep, mine** |
| `components/aircraft/live-banner.tsx:74` | the ADS-B row itself |
| `components/aircraft/tabs/dashboard.tsx:31` | the dashboard's airborne chip |

That is 18 requests a minute per open tab, for one aeroplane. Two of the three
predate this session; the hero's is new, so the work made an existing problem
worse rather than creating it. Opening the Utilization tab adds a fourth
(`flight-map.tsx:129`).

**Fix:** `detail-client` already provides `AircraftCtx`. Poll once there, put
`{status, state, track}` on the context, and have the banner, the dashboard chip
and the map read it. The landing callback stays with the banner — it is the only
consumer that needs it. Verify with the network panel: one request per 10s.

This one should probably not wait.

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
