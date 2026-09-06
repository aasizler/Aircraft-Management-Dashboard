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

## 3, 4, 5 — considered and declined, 6 Sep

Three items about the row's prominence, mocked up together because they are one
problem: "Searching…" flashing on load, a full banner for the quiet states, and
the sync pill riding inside the green live container when airborne.

Three alternatives were built and shown across every state — collapse the quiet
states to a single line, drop the card for a rule and a line, or render no row
at all when quiet. **The current full banner was preferred.** Not revisiting
unless something else changes.

Worth keeping in mind if it comes up again: the argument for changing it was
that the hero now carries the location, so a quiet row largely restates it, and
that the searching state is a full banner announcing a network request on every
page load. The argument against, which won, is that a constant-height row does
not shift the page when an aeroplane launches, and the quiet states still say
*why* there is no position — "not broadcasting" and "feed unreachable" are
different facts and the hero cannot carry either.

## Yours

- 
