// Domain types mirroring supabase/schema_v2_tenancy.sql. Hand-written for now;
// once the schema is deployed, regenerate the full DB types with:
//   npx supabase gen types typescript --project-id ggqucvfsqdvlhrfmrrcw > lib/database.types.ts
// and have these narrow, intention-revealing types re-export from it.

// Relationship to one specific aircraft. Resolved server-side by craft_role_of().
export type CraftRole = "owner" | "manager" | "pilot";

// Physical time source. Which one drives maintenance vs. cost is PER-AIRCRAFT:
// a Cirrus tracks inspections on `flight` but costs on `total`; a single-timer
// Bonanza points both bases at one meter. Never assume a global convention.
export type MeterKind = "hobbs" | "tach" | "flight" | "total";
