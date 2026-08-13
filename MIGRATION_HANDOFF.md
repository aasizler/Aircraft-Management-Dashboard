# AeroTrack — Next.js Migration Handoff

**Read this first.** It supersedes `AEROTRACK_HANDOFF.md` (that file describes the
legacy single-file HTML app and is stale). This covers the React/Next.js port.

---

## 1. The situation (why this project exists)

- **User:** Aidan, solo dev. Personal email `aasizler@gmail.com`.
- **Business:** Going 50/50 into **Hired Wings**, a small aircraft-management
  company, contributing AeroTrack as his value-in-kind. Wants the **app kept a
  separate entity** he can market to other management companies later. So: the
  app repo is under his **personal `aasizler` GitHub**, authored under his
  personal email — deliberately NOT the work account (`THCRE-Hub` /
  `technology@tophatcre.com`). Keep company-specific data out of the code; the
  company is just an `orgs` row.
- **Goal of the migration:** move from the localStorage-blob HTML app to a
  multi-tenant Next.js app with real owner/manager/contract-pilot roles.

## 2. Repo / git / auth

- **Remote:** `git@github.com:aasizler/Aircraft-Management-Dashboard.git` (SSH).
- **SSH is set up** on the Mac: key `~/.ssh/id_ed25519_aasizler`, `~/.ssh/config`
  pins `github.com` to it. Pushes "just work" as `aasizler`. **Windows needs its
  own key** (ssh-keygen + add `.pub` to github.com/settings/keys).
- **Branches:** all migration work is on **`migration/nextjs-foundation`**.
  `main` is the legacy HTML app, untouched and still deploying.
- Commit trailer in use: `Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>`.

## 3. Layout

- **Legacy app:** `aerotrack_v1_07_3_6.html` at repo root — the **source of truth
  for look & behavior** when porting. Still live. `index.html` redirects to it.
- **New app:** `web/` — **Next.js 16 (App Router), React 19, TypeScript,
  Tailwind 4, Supabase (@supabase/ssr), MapLibre.** Runs at **localhost:3000**
  via `npm run dev` (from `web/`).
- `web/README.md` has stack + a migration checklist.

## 4. Supabase (project `ggqucvfsqdvlhrfmrrcw`)

**Deployed & live:**
- `supabase/schema_v2_tenancy.sql` — tenancy/roles/meters schema
- Org bootstrap — org **"Hired Wings"** (slug `hired-wings`), admin = `aasizler`
- `supabase/import_v1_fleet.sql` — imported **3 aircraft** (N137BF, N6110K, N492DM)
- `supabase/storage_documents.sql` — `documents` bucket + per-aircraft policies
- Edge functions: `flight-monitor` (running), `adsb-trace` (legacy),
  **`meter-ocr` (deployed, `ANTHROPIC_API_KEY` secret set, Verify JWT ON)**

**Data model:** `orgs`, `org_members` (role admin|manager|member), `owner_entities`,
`aircraft` (org_id, `maint_basis`/`cost_basis` of type `meter_kind`, plus a `data`
jsonb holding the whole v1 aircraft object), `aircraft_meters` (one row per
time-source, the source of truth for current hours), `aircraft_access`
(owner|manager|pilot grants), `assignments` (date-windowed contract pilots),
`flights`, `squawks`, `aircraft_financials`, `expenses`, `meter_readings`,
`flight_history`. RLS everywhere via **`craft_role_of()` + `is_org_*()` SECURITY
DEFINER** helpers (definer is required — a policy on `org_members` that queries
`org_members` recurses otherwise).

**Key architectural decision:** the tabs read/write the **v1 object shape inside
`aircraft.data`** (inspections, oil, flights, schedule, insurance, documents,
monthlyHours). `save()` writes the whole `data` blob to the aircraft's **own
row** — this is the "only the storage changed" swap and it kills the old
fleet-blob last-write-wins bug. The normalized `flights`/`squawks` tables exist
but the UI does NOT use them yet.

## 5. Feature status (vs the HTML)

**Done in `web/`:** auth + RLS; hangar (Add Aircraft, tile menu → Archive,
drag-reorder); all 8 tabs (Dashboard, Inspections, Oil, Utilization w/ MapLibre
map, Flights, Schedule, Documents w/ Storage upload, Insurance) with editing
modals; ADS-B **live banner** + **live map marker** (keyless adsb.lol via
`lib/adsb.ts`); **meter-photo OCR** (MeterCapture → `meter-ocr` edge fn →
`apply_meter_reading` RPC, validated); **shared access** (Manage Access modal:
grant/list/revoke owner/manager/pilot + contract-pilot assignments); **Settings**
(light/dark theme + accent, account). CSS fully ported into `web/app/globals.css`
with the ORIGINAL class names.

**Missing / thinner than HTML (build order per the user):**
1. **ADS-B depth** — altitude-colored flight track on the map, side telemetry
   panel, landing-detection toast, hangar LIVE badges, last-flight replay,
   surfacing `flight_history`.
2. **Map/inspections/dashboard polish** — bigger map (currently fixed 380px),
   inspection add-custom/deactivate/edit (only "Mark Complied" exists),
   dashboard activity strip + quick actions + sparkline + live in-flight chip,
   oil consumption chart, add-aircraft type/airport autocomplete.

## 6. OPEN BUGS / pending fixes (agreed, not yet done)

1. **False-green (airworthiness):** unpopulated inspections render green "OK" and
   the Dashboard says "All Clear" even with zero recorded data (blatant on
   N492DM). Should show a neutral "not tracked" state and not read as compliant.
2. **0-hours garbage:** hour-based inspections print nonsense ("819 hrs rem")
   when the aircraft's current hours are 0. Handle gracefully.
3. **Meter-photo can't do the FIRST entry:** `apply_meter_reading()` rejects any
   >50hr jump, which blocks setting hours from 0. Exempt the initial set (current
   = 0). This is a SQL function change → redeploy the function.
4. **DATA: current hours are 0 on all 3 aircraft** (never entered in the old
   app; `fleet` blob had hobbs/tt = 0). N137BF is really ~810 hrs (oil log). Fix
   = set `aircraft_meters.current` per tail. Awaiting the 3 real Hobbs numbers.
   Template:
   ```sql
   update public.aircraft_meters m set current = case a.reg
       when 'N137BF' then 0 when 'N6110K' then 0 when 'N492DM' then 0 end
   from public.aircraft a
   where a.id = m.aircraft_id and m.kind = 'hobbs'
     and a.reg in ('N137BF','N6110K','N492DM');
   ```
5. **Minor:** empty airport shows a dangling status dot in the hero; inspections
   table clips below ~800px.

## 7. Gotchas (will bite you)

- **Stale dev server → app renders as PLAIN TEXT.** A long-running Turbopack dev
  server corrupts its CSS state. Fix: stop it, `npm run dev` fresh. Use port 3000.
- **Component CSS must be plain, NOT `@layer components`** in globals.css —
  Tailwind tree-shakes `@layer` classes in dev and the theme vanishes.
- **Meter basis is per-aircraft** (Cirrus flight/total, Bonanza single timer) —
  never `Math.max(hobbs, tt)`. Read `maint_hours()`/`cost_hours()` or the
  declared `maint_basis`/`cost_basis`. Current fleet is all `hobbs`/`hobbs`.
- **External tiles / adsb.lol are blocked in the in-app browser sandbox** but
  work in real Chrome. To QA the authed app, use **Claude-in-Chrome** on the
  user's real session (they must be signed in at localhost:3000 first — the
  extension must be connected).
- **Verification harness pattern:** create a throwaway `web/app/stylecheck/page.tsx`
  (client) that renders `AircraftDetailClient` with mock data + a `previewSave`
  no-op, and temporarily add `/stylecheck` to `isPublic` in
  `web/lib/supabase/middleware.ts`. Screenshot, then REMOVE both before commit.
- Cannot enter passwords/API keys — the user does the Anthropic key + any login.

## 8. Run / deploy

```bash
cd web && npm install && npm run dev     # http://localhost:3000
npm run build                            # typecheck + build (do before commit)
```
Deploy `web/` to Vercel (optional, for a shareable URL): Root Directory = `web`,
env vars `NEXT_PUBLIC_SUPABASE_URL` + `NEXT_PUBLIC_SUPABASE_ANON_KEY` (both in
`web/.env.example`), Production Branch = `migration/nextjs-foundation` until merged.

## 9. Where to look

- Detail shell + data layer: `web/components/aircraft/detail-client.tsx`
- Tabs: `web/components/aircraft/tabs/*`
- Domain logic (ic/oilLife, meter basis): `web/lib/aircraft.ts`
- ADS-B: `web/lib/adsb.ts`, `web/components/aircraft/live-banner.tsx`
- Map: `web/components/aircraft/flight-map.tsx`
- Shared access: `web/components/aircraft/manage-access.tsx`
- Settings/theme: `web/app/settings/page.tsx`, `web/components/settings/theme-controls.tsx`
- Meter OCR: `web/components/aircraft/meter-capture.tsx`, `supabase/functions/meter-ocr/index.ts`
- Project memory (auto-loaded): `~/.claude/projects/<this-project>/memory/` —
  see `project_schema_v2`, `project_meter_basis`, `project_flight_monitor`,
  `project_subscription_tiers`.
