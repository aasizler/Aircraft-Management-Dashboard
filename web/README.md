# AeroTrack — web (Next.js port)

The successor to the single-file HTML app at the repo root. Both run in parallel
against the **same Supabase project** until this reaches parity, then the root
app is retired. This app is the product; the management company is a tenant
(`orgs` row), never hardcoded here.

## Stack

Next.js 16 (App Router) · React 19 · TypeScript · Tailwind 4 · Supabase
(`@supabase/ssr`) · Vercel. shadcn/ui to be added for the component system.

## Run it

```bash
cp .env.example .env.local   # values are prefilled; anon key is public
npm install
npm run dev                  # http://localhost:3000
```

Unauthenticated requests redirect to `/login`. Sign in with an existing
Supabase auth user. The home page reads the fleet through RLS.

## Layout

```
app/
  page.tsx            fleet list (server component, RLS-scoped read)
  login/page.tsx      email + password sign-in
  auth/callback/      code exchange for email-link / recovery flows
lib/
  supabase/client.ts  browser client
  supabase/server.ts  server-component / route-handler client
  supabase/middleware.ts  session refresh + auth gate
  types.ts            domain types mirroring the SQL schema
middleware.ts         runs updateSession on every request
```

## Migration status & order

Schema lives at `../supabase/schema_v2_tenancy.sql` (multi-tenant, roles, meter
model). **It must be deployed to Supabase before this app can read data.**

1. [ ] Deploy `schema_v2_tenancy.sql` in the Supabase SQL editor
2. [ ] Bootstrap: create the org + your admin `org_members` row (see the SQL's
       BOOTSTRAP block)
3. [ ] Import script: v1 `fleet` blob → `aircraft` rows (maps `legacy_id`)
4. [x] Auth shell (login, session middleware, RLS-scoped fleet read)
5. [ ] shadcn/ui + design tokens — the fix for the legacy app's inconsistent UI
6. [ ] Aircraft detail: inspections (using `maint_basis`, NOT max(hobbs,tt))
7. [ ] Flights + squawks (normalized, role-aware writes)
8. [ ] Meter-photo OCR edge function + confirm flow
9. [ ] Port MapLibre map + D3 charts close to verbatim (hard-won, works)

## Key domain rules (do not re-derive — see repo memory)

- **Meter basis is per-aircraft.** Cirrus: maint=flight, cost=total. Bonanza:
  single timer. Inspection/SMOH math reads `maint_hours()`, billing reads
  `cost_hours()`. Never `Math.max(hobbs, tt)` — that is the live v1 bug.
- **Financials are a separate table** (`aircraft_financials`), not aircraft
  detail — RLS is row-level, so a pilot must not be able to select the row.
- **Contract pilots** get date-windowed access via `assignments` that expires
  on its own. They see airworthiness, not money; they may submit receipts
  (`expenses` insert without select).
