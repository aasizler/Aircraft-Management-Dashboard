# AeroTrack — v1 → Next.js Functional Parity Audit

> **Status: the gaps below have since been closed in `web/`.** This document is
> kept as the record of what was missing and why. See “Port status” at the end
> for what was built, what changed shape deliberately, and what is still open.

Method: enumerated all **283 function definitions** in the legacy inline script
(`aerotrack_v1_07_3_6.html` lines 1336–6303) and traced each to the `web/` port.
Verified live, side by side in Chrome: legacy served at `:5174` (seed fleet via
`CLOUD_ENABLED=false; skipAuth()`), new app at `:3000` signed in as
`aasizler@gmail.com` on the real N137BF data.

Scale check: legacy ≈ 4,968 lines of JS; `web/` ≈ 2,700 lines of TS/TSX.

Legend: ✅ ported · ⚠️ partial/thinner · ❌ missing · 🔄 intentionally replaced

---

## 0. Headline findings

1. **The tab sets don't match.** Legacy: Dashboard, Inspections, Oil and Fluids,
   **Squawks**, Utilization, Documents, Insurance, Schedule. New: Dashboard,
   Inspections, Oil, Utilization, **Flights**, Schedule, Documents, Insurance.
   Both are "8 tabs", but Squawks was dropped and Flights (a *section* of legacy
   Utilization) was promoted to a tab. Squawks is 16 unported functions.

2. **Live data is in `aircraft.data` and the UI doesn't read it.** N137BF's blob
   holds `flightRoutes` (79 entries), `maintCosts` (5 entries incl. a scanned
   fuel receipt), `squawks` (1 open), `oilByMonth`, `airportData`. None of it is
   surfaced. The Utilization map reads `data.flights` — which is `[]` — so the
   map is blank while the legacy map plots 79 routes.

3. **`monthlyHours` is read with the wrong shape.** Real value is
   `[0,0,0,0,0,23]` (plain numbers, month-indexed). `utilization.tsx` treats it
   as objects (`m.month`, `m.hours`), so it renders 6 unlabeled zero-height bars
   and reports **Total Logged 0.0 instead of 23**. Same shape for `oilByMonth`.

4. **Insurance field names diverged.** v1 writes
   `provider / expiration / hull / liability / deductible`; `insurance.tsx` reads
   `carrier / expires / coverage / premium`. Imported policies will never
   display, and saving from the Edit modal writes a *parallel* key set —
   silently forking the record.

5. **The "false-green" bug is a port regression, not inherited.** Legacy renders
   unpopulated inspections as a grey `NOT SET` badge with a "Log First" action.
   The port renders them green `OK`. Confirmed live on N137BF: ELT, Transponder,
   Pitot-Static and VOR Check all show green `OK` with `—` last-complied.

6. **Adding an aircraft produces a dead end.** Legacy `saveAircraft()` seeds
   `inspections: makeCoreInspections()` (7 regulatory items) plus `tbo` (1700),
   `oilInterval` (50), `engineSMOH`, `engineType`. `add-aircraft.tsx` inserts
   `data: {}` — so a new aircraft has **no inspections and no way to add any**
   (there is no "Log Inspection" button in the port), no TBO, no oil interval.

7. **No aircraft settings screen at all.** Legacy has a full Aircraft Settings
   modal (reg, serial, type, engine type, TT, SMOH, TBO, oil interval, home
   airport). The port has no edit path — once created, an aircraft's details are
   immutable through the UI.

---

## 1. Auth & session

| Legacy | Status | Notes |
|---|---|---|
| `initSupabase`, `onAuthChange`, `onSignedIn`, `onSignedOut`, `showAuthScreen`, `toggleAuthMode`, `authSubmit`, `signOut`, `updateAuthUI` | 🔄 | Replaced by `app/login`, `lib/supabase/middleware.ts`, `SignOutButton`. |
| `skipAuth` (local-only mode) | 🔄 | Deliberately gone — cloud is mandatory now. |
| `showForgotPassword`, `submitForgotPassword`, `submitNewPassword`, `sendPasswordReset` | ❌ | **No password reset anywhere in the port.** Login is email+password only; no "Forgot password?", no signup link. |

## 2. Persistence & sync

| Legacy | Status | Notes |
|---|---|---|
| `saveLS`, `loadLS`, `cloudSave`, `cloudPush`, `cloudLoad`, `cloudPull`, `setSyncStatus`, `_migrateFleet` | 🔄 | Replaced by per-row `save()` in `detail-client.tsx`. This is the intended fix for the fleet-blob race. |
| `initRealtime`, `handleRealtimeFleetUpdate`, `handleRealtimeSharesUpdate` | ❌ | No realtime subscription. Two managers on one aircraft won't see each other's edits until reload. |
| `_pullFlightHistory`, `_ensureLastFlightTrack` | ❌ | `flight_history` still unsurfaced (matches handoff item 1). |
| `saveSessionMeta`, `checkOfflineRevocations` | ❌ | |
| `_syncMonitoredAircraft` | ❌ | Nothing registers aircraft with the `flight-monitor` edge function. |

## 3. Hangar

| Legacy | Status | Notes |
|---|---|---|
| `renderHangar`, `selAC` | ✅ | |
| `enterRearrange`, `exitRearrange`, `tileDragStart/Move/End`, `cleanupDrag` | ⚠️ | Reorder works via HTML5 drag, but there's no explicit rearrange mode. `onDrop` fires N un-awaited `update()` calls with no error handling. |
| `openTileMenu`, `closeHangarMenus` | ⚠️ | Menu has **only** "Archive". |
| `openTileSettings` | ❌ | No aircraft settings (see headline 7). |
| `promptDeleteAircraft`, `doDeleteFromMenu`, `deleteAircraft` | ❌ | Archive only; no delete. |
| `getTileIcao`, `_checkHangarAdsb`, `_applyTileAirborne` | ❌ | No LIVE badges on hangar tiles. |
| `makeCoreInspections` | ❌ | Not called on add (see headline 6). |
| `saveAircraft` | ⚠️ | Port omits engine type, TBO, oil interval, SMOH and the seeded inspections. |

## 4. Hero / status bar

| Legacy | Status | Notes |
|---|---|---|
| `renderHero` | ⚠️ | Port shows reg/type/serial/airport/one meter. Missing: **squawk status dot**, TT, SMOH, `lastUpdated` text. |
| `refreshStatus` | ❌ | |

## 5. Inspections

| Legacy | Status | Notes |
|---|---|---|
| `ic`, `lastDayOfMonth`, `calMonthDue` | ✅ | Ported and **improved** — uses declared `maint_basis` instead of v1's `Math.max(hobbs,tt)`. |
| `renderInsp`, `_inspRow` | ⚠️ | 6 columns vs 8 — **Updated By** and **Updated On** dropped. Green-OK regression (headline 5). "819 hrs (819 hrs rem)" garbage at 0 hours reproduced live. |
| `openInspModal`, `saveInspection`, `onInspTypeChange` | ❌ | **Cannot add an inspection.** |
| `editInsp`, `promptClearInsp`, `clearInsp`, `closeClearConfirm` | ❌ | |
| `toggleInspActive`, `toggleInactiveSection` | ❌ | No deactivate / inactive section. |
| `preInsp` | ❌ | Dashboard→inspection deep-link. |
| `toggleRowMenu`, `closeRowMenus` | ❌ | |
| `migrateInspections` | ❌ | |

Only "Mark Complied" survives.

## 6. Oil and Fluids

| Legacy | Status | Notes |
|---|---|---|
| `oilLife` | ✅ | |
| `renderOilStats` | ⚠️ | Legacy: Oil Life, **Total Added**, **Avg/Month**, **Consumption per 10 hrs**. Port: Oil Life, Interval, Used Since Change. |
| `renderOilLog` | ✅ | |
| `openOilModal`, `saveOil`, `oilKindChanged` | ⚠️ | Legacy has a **Fluid Type** select (Engine Oil / Hydraulic / Brake) — it's "Oil *and Fluids*". Port has free-text "Oil Type". |
| `editOil` | ❌ | |
| Monthly Oil Consumption chart (`bChart`) | ❌ | |

## 7. Squawks — **entire tab missing** (16 functions)

`renderSq`, `renderArchiveTable`, `toggleSquawkArchive`, `toggleSqMenu`,
`closeSqMenus`, `openArchiveModal`, `handleArchivePDF`, `confirmArchiveSq`,
`restoreSq`, `promptDeleteSq`, `promptDeleteArchivedSq`, `closeSqConfirm`,
`viewArchiveDoc`, `openSquawkModal`, `editSq`, `saveSquawk` — all ❌.

Legacy supports Grounding / In Progress / Watch Item statuses, archive with a
sign-off PDF, restore, and delete. A `squawks` table already exists in
`schema_v2_tenancy.sql` and is unused. N137BF has 1 open squawk today.

## 8. Utilization & financials — mostly missing

| Legacy | Status | Notes |
|---|---|---|
| `renderUtil` | ⚠️ | Legacy stats: Last 6-mo hours, Monthly avg, **Engine TBO %**. Port: Total logged, Flights, Airports. |
| Monthly Flight Hours chart | ⚠️ | Broken by the `monthlyHours` shape bug (headline 3). |
| **TBO and Overhaul Progress** (SMOH + airframe bars) | ❌ | |
| `renderMaint`, `openMaintModal`, `saveMaint`, `deleteMaint` | ❌ | Maintenance cost tracker. **5 real entries in N137BF.** |
| `renderExpenseCharts` | ❌ | Monthly Spend, By Category, Cost per Flight Hour, Year-to-Date (d3). |
| `exportMaintExcel` | ❌ | |
| `openReceiptModal`, `resetReceiptModal`, `handleReceiptFile`, `compressReceiptImage`, `scanReceiptWithAI`, `showReceiptWarning`, `hideReceiptWarning`, `saveFromReceipt` | ❌ | Receipt scanning (8 functions). Note: the *meter*-photo OCR that was built is a different feature. |
| `saveApiKey`, `clearApiKey` | 🔄 | Correctly server-side now. |

## 9. Map — largely missing (~50 functions)

Ported: basemap Map/Satellite toggle, airport dots + labels, straight route
lines, live ADS-B dot, fit-to-bounds.

Missing:

- `setMapMode`, `_applyMapMode`, `_mlApplyModeVis`, `renderChips` — the
  **Airports / Routes mode toggle**.
- `_getOrCreateMapTooltip`, `_showMapTooltip`, `_hideMapTooltip`, `_mlWireHover`,
  `_hitTestRoute`, `_mlSetRouteHl` — hover tooltips and route highlighting.
- `openAirportDetail`, `openRouteDetail`, `zoomTo` — click-through detail modals.
- `mapZoomBtn`, `_getOrCreateHint`, `_showScrollHint`, `_hideScrollHint` — zoom
  buttons and the ctrl+scroll hint.
- `_mlUpdateLastFlightBtn`, `_mlToggleLastFlight`, `_mlShowLastFlight` —
  last-flight replay.
- `_altColor`, `_mlTrackGradient` — altitude-colored track.
- `_mlThemeLight`, `_mlRouteBaseColor`, `_mlBgColor`, `_getAccentHex` — the port's
  map is hardcoded dark and ignores theme/accent.
- `parseFF`, `clearMapData` — **ForeFlight CSV import**, the source of the 79
  routes already on file.
- `_loadFaaSupplemental`, `renderDebugPanel`, `loadGeo`/`drawMap`/`_drawMapNow`
  and the whole canvas fallback renderer.

Size: legacy map is full-width and ~630px tall; port is a fixed 380px.

## 10. ADS-B

| Legacy | Status | Notes |
|---|---|---|
| `_nToHex`, `_adsbFetch`, `_normalizeAdsb`, `_adsbStart`, `_adsbStop`, `_adsbPoll` | ✅ | Ported into `lib/adsb.ts`, keyless. |
| `_adsbKey`, `saveAdsbKey`, `clearAdsbKey`, `testAdsbKey` | 🔄 | No longer needed. |
| `_renderAdsbBanner` | ⚠️ | Simpler; no map button. |
| `_adsbCheckLanding`, `_pushLiveFlight`, `_nearestAirport`, `_showLandingPrompt`, `prefillFlightFromAdsb` | ❌ | Landing detection → auto flight-log prompt. |
| `_adsbRecordTrack`, `_adsbFetchFullTrack`, `_drawAdsbOverlay`, `_getPlaneImg` | ❌ | Track recording + altitude-colored overlay. |
| `_getOrCreateAdsbPanel`, `_openAdsbPopup`, `_closeAdsbPopup`, `_fillAdsbPanel`, `_refreshAdsbPopup` | ❌ | Side telemetry panel. |
| `_adsbMapBtn`, `_adsbGoToMap` | ❌ | |

## 11. Flights

| Legacy | Status | Notes |
|---|---|---|
| `renderFlightLog`, `openFlightModal`, `saveFlight` | ✅ | |
| `editFlight` | ❌ | |
| Route push to map on save | ❌ | Port writes `flights` only; map/`flightRoutes` never updated. |

## 12. Insurance

| Legacy | Status | Notes |
|---|---|---|
| `renderInsurance` | ⚠️ | Field-name mismatch (headline 4). Missing the 4 stat cards (Hull Value, Liability, Named Pilots, Renewal) and the **expiry badge**. |
| `renderInsurancePilots`, `openAddPilotModal`, `saveInsurancePilot` | ✅ | |
| `openInsuranceModal`, `saveInsurance` | ⚠️ | Edits the wrong keys. |
| Coverage Notes panel | ❌ | |
| `openInsPdfModal` / Policy Documents | ❌ | |

## 13. Schedule

| Legacy | Status | Notes |
|---|---|---|
| `renderScheduleList`, `openScheduleModal`, `saveScheduleEvent` | ✅ | |
| `renderSchedule` + `filterSchedule` | ❌ | The **14-day date-strip calendar** is gone; port is a flat list. |
| Edit / delete an event | ❌ | |

## 14. Documents

| Legacy | Status | Notes |
|---|---|---|
| `uploadDocToCloud`, `getDocUrl`, `deleteDocFromCloud`, `viewCloudDoc`, `renderDocs`, `viewDoc` | ✅ | Storage path is solid. |
| `handlePDF` | ⚠️ | No **HEIC→JPEG** conversion (legacy loads `heic2any`); iPhone uploads will land unviewable. No size/type validation. |
| `closePDF` / inline preview | ❌ | Port opens a signed URL in a new tab. |

## 15. Sharing & roles

| Legacy | Status | Notes |
|---|---|---|
| `openManageAccess`, `renderSharesList`, `inviteUser`, `changeRole`, `revokeAccess`, `pullSharedAircraft` | ✅ | Well covered by `manage-access.tsx` + RLS. |
| `checkPendingInvites`, `showPendingBanner`, `hidePendingBanner`, `acceptInvite`, `declineInvite`, `openPendingInvitesModal`, `resolveEmailInvites` | ❌ | **No invite acceptance flow** — 7 functions. A grantee has no way to see or accept a pending invite. |
| `getRole`, `can` | ❌ | No client-side permission gating. Legacy hides the whole financial section from mechanic/viewer roles via `can('financial')`. RLS protects the data, but the UI shows controls it shouldn't. |

## 16. Global settings

| Legacy | Status | Notes |
|---|---|---|
| `setTheme`, `applyTheme` | ⚠️ | **No "System"** option (legacy has Dark/Light/System). |
| `setAccent`, `applyAccent` | ⚠️ | 6 accents vs legacy's 8. Legacy stores names (`'blue'`), port stores hex — existing `at_accent` values won't resolve. |
| `confirmResetData` | ❌ | Delete All Personal Data. |
| Storage usage readout | ❌ | |

## 17. Autocomplete & lookup — all missing (10 functions)

`acType`, `acAirport`, `acPick`, `acPickAirport`, `acHover`, `acKey`,
`showExistingAirport`, `acEngine`, `acPickEngine`, `showEngineResolved` — ❌.

Aircraft-type, airport (with resolved-name confirmation) and engine
(auto-fills HP/TBO) autocomplete are all plain text inputs in the port.
`apLookup` ✅ (reimplemented inside `flight-map.tsx`).

## 18. Misc UI

| Legacy | Status | Notes |
|---|---|---|
| `openModal`, `closeModal` | ✅ | `components/ui/modal.tsx`. |
| `toggleDotMenu`, `closeDotMenus` | ⚠️ | No click-outside-to-close. |
| `showToast`, `dismissToast` | ❌ | **No toast system.** Errors are mostly swallowed — `save()` sets a badge to "Error" with no message. |
| `confirmDel`, `cDel` | ❌ | No delete confirmations; Documents deletes immediately. |
| `renderActivity`, `_sparkline`, `_updateDashLiveChip`, `renderNextDue`, `renderDashboard` | ⚠️ | See below. |

## 19. Dashboard detail

Legacy: status ribbon → **quick actions** (Log Flight / Add Squawk / Log Oil /
Oil Change) → **Needs Attention** alert feed (click-through to the offending
inspection) → At a Glance KPIs (6-Month Hours **with sparkline**, Engine SMOH %,
Oil Life, **Active Squawks**, **Documents** — all clickable) → **Recent Activity**.

Port: status card → next-due card → 5 non-clickable KPIs (maint hrs, cost hrs,
oil life, overdue, engine SMOH).

Missing: quick actions, alert feed, sparkline, recent activity, squawk/document
KPIs, live in-flight chip, and all click-through.

---

## Suggested order of work

**Data-loss / correctness first — these are actively wrong on real data:**

1. `monthlyHours` / `oilByMonth` shape fix (23 hrs currently reported as 0).
2. Insurance field names — read v1 keys, migrate or alias.
3. Map should read `flightRoutes` (79 entries), not `flights`.
4. False-green inspections — restore the `NOT SET` / "Log First" state.
5. 0-hour inspection math.
6. Seed `makeCoreInspections()` + TBO/oil interval on Add Aircraft.

**Then the functional dead ends:**

7. Inspections: add / edit / clear / deactivate.
8. Aircraft Settings screen.
9. Squawks tab (schema already exists).
10. Invite acceptance flow.
11. Toasts + error surfacing; delete confirmations.

**Then the depth items already on the roadmap:**

12. Maintenance costs + expense analytics + receipt scanning + Excel export.
13. ADS-B depth (track, telemetry panel, landing detection, LIVE badges).
14. Map depth (modes, tooltips, detail modals, zoom, replay, ForeFlight import).
15. Dashboard polish (quick actions, alert feed, sparkline, activity).
16. Schedule calendar strip, oil consumption chart, TBO progress bars,
    autocompletes, HEIC handling, System theme, password reset.

---

## Notes on the legacy itself

- `aerotrack_v1_07_3_6.html` line ~660 has a template-literal escaping bug: the
  Utilization toolbar prints the literal text `${can('financial')?'` instead of
  rendering the Log Cost / Scan Receipt buttons. Visible in the running legacy
  app on `main`. Don't port that.
- The repo's `.claude/launch.json` `aerotrack` entry can't serve the repo
  directory — the sandboxed server hits macOS TCC on `~/Documents` and returns
  500. Serving a copy from the scratchpad works.

---

# Port status — what was built

Every item in the audit above is now implemented in `web/`, except where noted
under **Still open**. `npm run build` is clean; `tsc --noEmit` is clean; ESLint
reports one pre-existing warning (`manage-access.tsx`).

## New files

| File | Replaces |
|---|---|
| `components/ui/toast.tsx` | `showToast` / `dismissToast` |
| `components/ui/confirm.tsx` | `confirmDel` / `promptDeleteSq` / `promptDeleteAircraft` |
| `components/ui/row-menu.tsx` | `toggleRowMenu` / `toggleSqMenu` (+ click-outside) |
| `components/ui/charts.tsx` | `bChart` and the four d3 expense charts (SVG, no d3) |
| `components/ui/autocomplete.tsx` | `acType` / `acAirport` / `acEngine` + `acKey` / `acHover` / `acPick` |
| `lib/reference-data.ts` | `AIRCRAFT_DB`, `AP_FULL`, `ENGINE_DB` (lifted verbatim) |
| `components/aircraft/aircraft-settings.tsx` | the Aircraft Settings modal / `saveSettings` |
| `components/aircraft/tabs/squawks.tsx` | the whole Squawks tab (16 functions) |
| `components/aircraft/maint-costs.tsx` | `renderMaint` + `renderExpenseCharts` + `exportMaintExcel` |
| `components/aircraft/adsb-panel.tsx` | `_getOrCreateAdsbPanel` / `_fillAdsbPanel` |
| `components/settings/danger-zone.tsx` | `confirmResetData` |
| `components/settings/change-password.tsx` | `submitNewPassword` |
| `scripts/copy-maplibre-worker.mjs` | (new — see MapLibre note below) |

## Data-correctness fixes

1. **`monthlyHours` / `oilByMonth` shape** — `readMonthly()` accepts v1's plain
   number array *and* the object form. N137BF's 23 logged hours now report as
   23.0, not 0.0.
2. **Insurance field names** — `readInsurance()` reads v1's
   `provider/expiration/hull/liability/deductible` and falls back to the port's
   earlier `carrier/expires/...`, so imported policies display and edits no
   longer fork the record.
3. **Map reads `flightRoutes`** — `allRoutes()` merges `flightRoutes` (79 legs on
   N137BF) with the manual flight log; `airportCounts()` prefers v1's
   precomputed `airportData`. The map went from empty to 34 airports / 78 legs.
4. **False-green fixed** — `ic()` returns a new `none` state for never-recorded
   inspections (grey `NOT SET` + “Log First”) and `unknown` when an hour-based
   interval has no usable meter. The dashboard gained a matching “Not Yet
   Tracked” ribbon instead of claiming “All Clear”.
5. **0-hour math fixed** — an hour-based interval is not evaluated against a
   zero meter, so “819 hrs (819 hrs rem)” no longer appears.
6. **Add Aircraft seeds properly** — `makeCoreInspections()` plus TBO, oil
   interval, SMOH, engine type and the empty v1 collections. A new aircraft is
   no longer a dead end.
7. **Oil life honesty** — `oilLife()` now reports `tracked: false` when there is
   nothing to measure against, so an untouched aircraft shows “—”, not 100%.

## Deliberate deviations from v1

- **Squawk sign-off attachments** go to Supabase Storage, not localStorage
  base64 (v1 blew the 5MB quota).
- **Export is CSV**, not v1's `.xls`-flavoured HTML table — opens in Excel and
  Sheets alike.
- **"Delete All Personal Data"** archives the org's aircraft rather than erasing
  them: the fleet is shared, so a hard wipe would destroy other members' data.
  Per-aircraft hard delete lives on the hangar tile menu instead.
- **API-key panels stay gone** (ADS-B is keyless, OCR is server-side).
- Charts are inline SVG rather than canvas/d3 — no new dependency, and they
  follow the theme.

## MapLibre worker — required fix

MapLibre GL v6 spawns a **module worker** resolved through `import.meta.url`,
which Next's bundler rewrites to a URL the worker cannot load. The worker
spawns, never answers, and **every GeoJSON layer renders empty while raster
tiles still draw** — which is why the map showed no dots, no routes and no live
position, and had never worked in the port.

Fix: `scripts/copy-maplibre-worker.mjs` copies `maplibre-gl-worker.mjs` and the
`maplibre-gl-shared.mjs` chunk it imports into `public/maplibre/`, and
`flight-map.tsx` calls `maplibregl.setWorkerUrl("/maplibre/maplibre-gl-worker.mjs")`.
The script runs on `predev`, `prebuild` and `postinstall` so a MapLibre upgrade
can't leave a stale worker behind. `public/maplibre/` is gitignored.

A `glyphs` URL was also missing from the style, which made `addLayer` throw on
the airport-label symbol layer and abort the rest of the load handler.

## Still open

Verified against the tree, not from memory. The UI/feature items this section
used to list (invite acceptance, realtime, role gating, receipt scanning,
ADS-B track persistence, the `manage-access` lint warning) are all **built** —
see `pending-invites.tsx`, `lib/realtime.ts`, `lib/permissions.ts`,
`receipt-scan.tsx`, `lib/flight-history.ts`. What remains is backend and
deployment, not porting:

- **`apply_meter_reading()` rejects the first meter entry.**
  `schema_v2_tenancy.sql:463` refuses any delta > 50 hrs as `implausible_delta`.
  That is correct for an ongoing aircraft but blocks the *initial* capture,
  where `current` is 0 and the meter reads e.g. 4349.4. Needs a carve-out for
  the 0 → first-reading case. Affects the meter-photo path only.
- **Realtime is subscribed but never published.** `lib/realtime.ts` listens on
  `postgres_changes`, but no `.sql` in this repo adds `aircraft` /
  `aircraft_access` to the `supabase_realtime` publication, so no events are
  emitted. One-time SQL, run in the dashboard.
- **N137BF and N6110K still carry `current = 0` hours** — data, not code, and
  blocked by the guard above.
- **Receipt scanning is done and measured.** One Haiku call per receipt (v1's
  shape, ~7x cheaper than tiling everything); the model also reports `doc_type`,
  and a multi-line FBO invoice escalates to native-resolution tiles. Measured
  over 13 passes on 5 real receipts: every total correct, till rolls at 1 call.
  Note `amount_confidence` came back 0.95 on all five including the one the
  model used to misread — `doc_type` is the only signal worth trusting.
- **`meter-ocr` repo copy is simpler than the deployed one** (the abandoned
  two-pass `locate` mode was removed). The client no longer sends `mode` at all
  and the deployed build defaults to the read path, so the two behave
  identically; redeploy only to keep them in sync.
- **Meters run on Haiku** via the `OCR_MODEL` secret — 3x cheaper than Sonnet,
  and verified on a real G3X photo. Haiku reads airspeed placards and the
  heading as meter values, so a reading found in only one tile is dropped
  rather than prefilled; every correct value appeared in two tiles, every
  phantom in one.

## Deliberately not ported

- **Aircraft-level archive** — stripped on request. Nothing writes `archived`;
  `app/page.tsx` still filters on it only so rows archived by an earlier build
  stay hidden. (Squawk archiving is a separate, intended feature and is built.)
- **`skipAuth` / local-only mode** — cloud is mandatory now.
- **Legacy's canvas/d3 charts** — replaced by inline themed SVG.
- **The `${can('financial')?'` template-literal bug** at legacy line ~660.
