// Domain types mirroring supabase/schema_v2_tenancy.sql. Hand-written for now;
// once the schema is deployed, regenerate the full DB types with:
//   npx supabase gen types typescript --project-id ggqucvfsqdvlhrfmrrcw > lib/database.types.ts
// and have these narrow, intention-revealing types re-export from it.

// Standing role inside the management company (the tenant).
export type OrgRole = "admin" | "manager" | "member";

// Relationship to one specific aircraft. Resolved server-side by craft_role_of().
export type CraftRole = "owner" | "manager" | "pilot";

// Physical time source. Which one drives maintenance vs. cost is PER-AIRCRAFT:
// a Cirrus tracks inspections on `flight` but costs on `total`; a single-timer
// Bonanza points both bases at one meter. Never assume a global convention.
export type MeterKind = "hobbs" | "tach" | "flight" | "total";

export interface Org {
  id: string;
  name: string;
  slug: string | null;
  created_at: string;
}

export interface Aircraft {
  id: string;
  org_id: string;
  owner_entity_id: string | null;
  reg: string;
  serial: string | null;
  type: string | null;
  airport: string | null;
  icao24: string | null;
  maint_basis: MeterKind; // inspections, SMOH, TBO
  cost_basis: MeterKind; // billing, utilization, $/hr
  data: Record<string, unknown>; // denormalized detail ported from v1 blob
  sort_order: number;
  archived: boolean;
  legacy_id: string | null;
}

export interface AircraftMeter {
  aircraft_id: string;
  kind: MeterKind;
  label: string | null;
  current: number;
}

export interface Flight {
  id: string;
  aircraft_id: string;
  flight_date: string;
  dep_code: string | null;
  arr_code: string | null;
  meter_kind: MeterKind | null;
  meter_out: number | null;
  meter_in: number | null;
  duration_h: number | null;
  pic: string | null;
  billable: boolean;
  source: "manual" | "adsb" | "import";
}

// Values keyed by meter kind, e.g. { flight: 1234.5, total: 1402.3 }.
export type MeterValues = Partial<Record<MeterKind, number>>;

export interface MeterReading {
  id: string;
  aircraft_id: string;
  captured_at: string;
  image_path: string | null;
  values_raw: MeterValues;
  values_final: MeterValues | null;
  confidence: number | null;
  status: "pending" | "confirmed" | "rejected";
  flagged: boolean;
}
