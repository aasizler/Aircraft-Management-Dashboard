import type { CraftRole } from "./types";

/**
 * Per-aircraft permissions, ported from v1's getRole() / can().
 *
 * v1's roles were owner / co_owner / mechanic / viewer. v2's schema uses
 * owner / manager / pilot on aircraft_access, plus the org-level admin|manager
 * |member on org_members, so the table below maps v2 roles onto v1's
 * permission set rather than inventing a new one:
 *
 *   v1 owner     → org admin/manager, or an `owner` grant
 *   v1 co_owner  → `owner` grant (sees money, can't manage access)
 *   v1 mechanic  → `pilot` grant (airworthiness + logging, no money)
 *   v1 viewer    → no grant
 *
 * RLS is the real boundary — this only decides what the UI offers, exactly as
 * v1 used it to hide the financial section from mechanics and viewers.
 */
export type Permission =
  | "view"
  | "edit_settings"
  | "squawk"
  | "inspection"
  | "log_flight"
  | "upload_doc"
  | "view_doc"
  | "financial"
  | "manage_access"
  | "delete";

export type AppRole = "owner" | "co_owner" | "mechanic" | "viewer";

const PERMS: Record<AppRole, Permission[]> = {
  owner: [
    "view", "edit_settings", "squawk", "inspection", "log_flight",
    "upload_doc", "view_doc", "financial", "manage_access", "delete",
  ],
  co_owner: [
    "view", "edit_settings", "squawk", "inspection", "log_flight",
    "upload_doc", "view_doc", "financial",
  ],
  mechanic: ["view", "squawk", "inspection", "log_flight", "upload_doc", "view_doc"],
  viewer: ["view", "view_doc"],
};

export const ROLE_LABELS: Record<AppRole, string> = {
  owner: "Owner",
  co_owner: "Co-Owner",
  mechanic: "Mechanic",
  viewer: "Viewer",
};

/**
 * What a GRANT is called — always the wording the granter chose in Manage
 * Access.
 *
 * The AppRole labels above name a permission set, not a grant. Running an
 * invite through resolveRole() first meant someone granted "Pilot" was told
 * they'd been invited as "Mechanic", because that is the v1 permission bucket
 * pilot maps onto. Anywhere we describe a grant, use these.
 */
export const CRAFT_ROLE_LABELS: Record<CraftRole, string> = {
  owner: "Owner",
  manager: "Manager",
  pilot: "Pilot",
};

export const CRAFT_ROLE_COLORS: Record<CraftRole, string> = {
  owner: "var(--ok)",
  manager: "var(--accent)",
  pilot: "var(--warn)",
};

/** Resolves the effective app role from the org membership + aircraft grant. */
export function resolveRole(
  orgRole: string | null | undefined,
  craftRole: CraftRole | null | undefined,
): AppRole {
  if (orgRole === "admin" || orgRole === "manager") return "owner";
  if (craftRole === "owner") return "co_owner";
  if (craftRole === "manager") return "owner";
  if (craftRole === "pilot") return "mechanic";
  return "viewer";
}

export function can(role: AppRole, permission: Permission): boolean {
  return (PERMS[role] ?? PERMS.viewer).includes(permission);
}
