"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { useFleetAirborne } from "@/lib/adsb";
import { ic, meterValue, type AircraftRow, type Insp, type Meter, type Squawk, type V1Aircraft } from "@/lib/aircraft";
import { ManageAccess } from "@/components/aircraft/manage-access";
import { AircraftSettings } from "@/components/aircraft/aircraft-settings";
import { Confirm } from "@/components/ui/confirm";
import { Modal } from "@/components/ui/modal";
import { useToast } from "@/components/ui/toast";
import { markSelfInitiated } from "@/lib/access-events";
import { CRAFT_ROLE_LABELS, ROLE_LABELS, can, type AppRole } from "@/lib/permissions";
import type { CraftRole, MeterKind } from "@/lib/types";

export type Tile = {
  id: string;
  org_id: string;
  cost_basis: MeterKind;
  reg: string;
  type: string | null;
  serial: string | null;
  airport: string | null;
  maint_basis: MeterKind;
  data: V1Aircraft;
  meters: Meter[];
  /** Effective role for THIS aircraft, resolved server-side. */
  appRole: AppRole;
  /** This user's own aircraft_access row, when they got here via a grant. */
  grantId: string | null;
  /** That grant's role, shown on the badge. Null for org staff. */
  craftRole: CraftRole | null;
  /** Belongs to another org — someone else's record, shared with you. */
  shared: boolean;
  /** Who shared it, when known. */
  sharedBy: string | null;
  /** Which fleet section it sits under. Null = ungrouped. */
  fleetId: string | null;
};

export type Fleet = { id: string; name: string; org_id: string };

export function HangarGrid({
  aircraft,
  fleets = [],
  canManageFleets,
  shareableFleetIds = [],
}: {
  aircraft: Tile[];
  fleets?: Fleet[];
  /** Org staff; fleets write is is_org_staff(). */
  canManageFleets?: boolean;
  /**
   * Fleets this viewer may pass on. Org staff get all of them; a grantee gets
   * only the ones they hold a `manager` grant on. Sharing and administering are
   * separate rights: being handed a fleet lets you pass it on, not rename or
   * destroy somebody else's.
   */
  shareableFleetIds?: string[];
}) {
  const router = useRouter();
  const toast = useToast();
  const [menu, setMenu] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [order, setOrder] = useState<Tile[]>(aircraft);

  // The server owns the tile list; `order` is only a local overlay so dragging
  // feels instant. useState seeds once, so without this every later payload was
  // thrown away: a role change left the badge reading Pilot after a promotion
  // to Owner, and a grant or revocation didn't add or remove a tile until a
  // full reload. AccessWatcher's router.refresh() was working the whole time —
  // its results just had nowhere to land.
  useEffect(() => {
    setOrder(aircraft);
    // Props from a server component keep their identity until a new payload
    // arrives, so this runs when the data actually changed and not on every
    // client re-render.
    // eslint-disable-next-line react-hooks/set-state-in-effect
  }, [aircraft]);
  const [dragId, setDragId] = useState<string | null>(null);
  const [confirmTile, setConfirmTile] = useState<Tile | null>(null);
  const [leaveTile, setLeaveTile] = useState<Tile | null>(null);
  // Opened in place. These used to router.push to the aircraft with ?access=1
  // or ?settings=1, so asking who had access dragged you out of the hangar and
  // into the aircraft's records — a detour you never asked for.
  const [accessTile, setAccessTile] = useState<Tile | null>(null);
  const [settingsTile, setSettingsTile] = useState<Tile | null>(null);
  const [shareFleet, setShareFleet] = useState<Fleet | null>(null);
  const [renameFleet, setRenameFleet] = useState<Fleet | null>(null);
  const [renameTo, setRenameTo] = useState("");
  const [deleteFleet, setDeleteFleet] = useState<Fleet | null>(null);
  const [deleteImpact, setDeleteImpact] = useState<{ craft: number; people: number } | null>(null);
  const [fleetMenu, setFleetMenu] = useState<string | null>(null);
  // v1 gated reordering behind an explicit mode; tiles only drag once it's on,
  // and a plain click opens the aircraft rather than starting a drag.
  const [rearrange, setRearrange] = useState(false);

  const airborne = useFleetAirborne(aircraft.map((a) => a.reg));
  // A grant or revocation elsewhere should reshape the hangar immediately.

  // Entered from the nav ⋮ "Rearrange Hangar" item.
  useEffect(() => {
    const on = () => { setMenu(null); setRearrange(true); };
    window.addEventListener("aerotrack:rearrange", on);
    return () => window.removeEventListener("aerotrack:rearrange", on);
  }, []);

  // Close only when the mousedown lands OUTSIDE the menu, the way the nav ⋮
  // does it. Closing on any mousedown tore the menu down before the click
  // completed, so the item under the cursor never received it — the buttons
  // looked inert because they were being unmounted mid-press.
  const fleetMenuRef = useRef<HTMLSpanElement | null>(null);
  useEffect(() => {
    if (!fleetMenu) return;
    const onDoc = (e: MouseEvent) => {
      if (!fleetMenuRef.current?.contains(e.target as Node)) setFleetMenu(null);
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [fleetMenu]);

  useEffect(() => {
    if (!rearrange) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setRearrange(false);
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [rearrange]);

  /**
   * Which ⋮ items this role gets. Someone reaching an aircraft through an
   * assignment rather than a grant qualifies for none of them, and an empty
   * popup is worse than no button.
   */
  function menuFor(t: Tile) {
    const access = can(t.appRole, "manage_access");
    return {
      settings: can(t.appRole, "edit_settings"),
      access,
      remove: can(t.appRole, "delete"),
      leave: !access && !!t.grantId,
      // Everyone with any relationship may see WHO else has access; only a
      // manager may change it.
      viewAccess: !access,
    };
  }

  /**
   * Airworthiness at a glance, as a chip you can read across the hangar rather
   * than v1's 8px dot.
   *
   * Two corrections to what the dot computed:
   *
   *  - a GROUNDING SQUAWK now counts. The dot scored inspections only, so an
   *    aeroplane grounded by an open squawk showed green as long as its
   *    paperwork was in date — the one state you most need to see.
   *  - an aircraft with nothing recorded is no longer green. lib/aircraft.ts
   *    already refuses to call an unrecorded inspection "ok" for the same
   *    reason; the tile was still painting a brand-new airframe as airworthy.
   */
  function tileStatus(t: Tile): { label: string; cls: string } {
    const hrs = meterValue(t.meters, t.maint_basis);
    const active = ((t.data?.inspections ?? []) as Insp[]).filter((i) => !i.inactive);
    const scored = active.map((i) => ic(i, hrs).s);
    const grounding = ((t.data?.squawks ?? []) as Squawk[]).some((q) => q.status === "open");

    if (grounding || scored.includes("overdue")) return { label: "Grounded", cls: "grounded" };
    if (scored.includes("warn")) return { label: "Due Soon", cls: "due" };
    // Nothing has actually been signed off — say so instead of implying current.
    if (!scored.includes("ok")) return { label: "Not Tracked", cls: "untracked" };
    return { label: "Current", cls: "current" };
  }

  async function remove(t: Tile) {
    setBusy(true);
    // .select() so we can see the rowcount. The delete policy is
    // is_org_staff(), and RLS filters non-matching rows instead of raising —
    // without this a refused delete looked identical to a successful one and
    // the tile vanished locally until the next reload.
    const { data, error } = await createClient()
      .from("aircraft").delete().eq("id", t.id).select("id");
    setBusy(false);
    setConfirmTile(null);
    setMenu(null);
    if (error) { toast(`Delete failed: ${error.message}`, "danger"); return; }
    if (!data?.length) {
      toast("You don't have permission to delete this aircraft.", "danger");
      return;
    }
    setOrder((o) => o.filter((x) => x.id !== t.id));
    toast(`${t.reg} deleted`, "ok");
    router.refresh();
  }

  /**
   * Hand back your own grant. Goes through the same RPC as declining an
   * invite — both are "drop my aircraft_access row" — because the table's
   * only write policy is is_org_staff(), so a direct delete would match zero
   * rows and report success while changing nothing.
   */
  async function leave(t: Tile) {
    if (!t.grantId) return;
    setBusy(true);
    // Same reason as declining: you left, you weren't revoked.
    markSelfInitiated(t.grantId);
    const { data, error } = await createClient()
      .rpc("decline_aircraft_access", { p_access: t.grantId });
    setBusy(false);
    setLeaveTile(null);
    setMenu(null);
    if (error) { toast(`Could not leave: ${error.message}`, "danger"); return; }
    if (!data) { toast("You no longer have a grant on this aircraft.", "danger"); router.refresh(); return; }
    setOrder((o) => o.filter((x) => x.id !== t.id));
    toast(`Left ${t.reg}`, "ok");
    router.refresh();
  }

  /**
   * Settings edits the aircraft's data blob. On the detail page that is the
   * page's own save(); here the hangar owns it, and checks the rowcount for the
   * same reason — RLS refusals return no error.
   */
  async function saveData(t: Tile, next: V1Aircraft) {
    const { data, error } = await createClient()
      .from("aircraft").update({ data: next }).eq("id", t.id).select("id");
    if (error) { toast(`Save failed: ${error.message}`, "danger"); return; }
    if (!data?.length) {
      toast("You don't have permission to change this aircraft.", "danger");
      return;
    }
    router.refresh();
  }

  async function renameFleetTo(f: Fleet, name: string) {
    const n = name.trim();
    if (!n) return;
    setBusy(true);
    const { data, error } = await createClient()
      .from("fleets").update({ name: n }).eq("id", f.id).select("id");
    setBusy(false);
    setRenameFleet(null);
    if (error) {
      // Unique index is on (org_id, lower(name)).
      toast(error.code === "23505" ? "You already have a fleet with that name." : error.message, "danger");
      return;
    }
    // fleets write is is_org_staff(); RLS filters rather than raising.
    if (!data?.length) { toast("You don't have permission to rename this fleet.", "danger"); return; }
    toast(`Renamed to ${n}`, "ok");
    router.refresh();
  }

  /**
   * Count what deleting a fleet actually costs before asking. Deleting one
   * detaches its aircraft (the FK is on delete set null) and drops every grant
   * that targeted it — so people lose access to several aircraft at once, and
   * that shouldn't be a surprise discovered afterwards.
   */
  async function loadDeleteImpact(f: Fleet) {
    setDeleteFleet(f);
    setDeleteImpact(null);
    const s = createClient();
    const [{ count: craft }, { count: people }] = await Promise.all([
      s.from("aircraft").select("id", { count: "exact", head: true }).eq("fleet_id", f.id),
      s.from("aircraft_access").select("id", { count: "exact", head: true }).eq("fleet_id", f.id),
    ]);
    setDeleteImpact({ craft: craft ?? 0, people: people ?? 0 });
  }

  async function doDeleteFleet(f: Fleet) {
    setBusy(true);
    const { data, error } = await createClient()
      .from("fleets").delete().eq("id", f.id).select("id");
    setBusy(false);
    setDeleteFleet(null);
    setDeleteImpact(null);
    if (error) { toast(`Delete failed: ${error.message}`, "danger"); return; }
    if (!data?.length) { toast("You don't have permission to delete this fleet.", "danger"); return; }
    toast(`${f.name} deleted — its aircraft are still here`, "ok");
    router.refresh();
  }

  async function onDrop(targetId: string) {
    if (!dragId || dragId === targetId) return;
    // Dragging is reordering, not re-filing. Moving between fleets is a
    // deliberate change made in Aircraft Settings, not something that should
    // happen because a tile was dropped one section over.
    const from0 = order.find((t) => t.id === dragId);
    const to0 = order.find((t) => t.id === targetId);
    if (!from0 || !to0 || from0.fleetId !== to0.fleetId) { setDragId(null); return; }

    const next = [...order];
    const from = next.findIndex((t) => t.id === dragId);
    const to = next.findIndex((t) => t.id === targetId);
    next.splice(to, 0, next.splice(from, 1)[0]);
    setOrder(next);
    setDragId(null);

    const supabase = createClient();
    const results = await Promise.all(
      next.map((t, i) => supabase.from("aircraft").update({ sort_order: i }).eq("id", t.id)),
    );
    if (results.some((r) => r.error)) toast("Could not save the new order", "danger");
  }

  // A fleet is a section. Ungrouped aircraft keep the original heading and sit
  // at the bottom, so a hangar with no fleets looks exactly as it always did.
  const sections: {
    key: string;
    label: string;
    sub?: string;
    fleet?: Fleet;
    tiles: Tile[];
  }[] = [
    ...fleets
      .map((f) => ({
        key: f.id,
        label: f.name,
        fleet: f,
        tiles: order.filter((t) => t.fleetId === f.id),
      }))
      // Deliberately NOT filtered by tile count. A fleet with nothing in it
      // used to render nowhere, which meant that once created it could never
      // be renamed, shared or deleted — create with no delete.
      ,
    {
      key: "__none__",
      label: "Active Aircraft",
      sub: "All aircraft you currently own or are managing.",
      // Explicitly undefined so this shares a shape with the fleet sections;
      // without it the array is a union and `s.fleet` isn't reachable below.
      fleet: undefined as Fleet | undefined,
      tiles: order.filter(
        (t) => !t.fleetId || !fleets.some((f) => f.id === t.fleetId),
      ),
    },
    // Only the ungrouped section is dropped when empty; a hangar whose aircraft
    // are all filed shouldn't show a stray "Active Aircraft" heading.
  ].filter((s) => s.fleet || s.tiles.length > 0);

  return (
    <>
      {sections.map((section) => (
        <div key={section.key}>
          <h2 className="section-lbl">
            {section.label}
            {/* Sharing a fleet lives on the fleet, not on any one aircraft in
                it — a grant here covers every aircraft in the section, and
                anything filed into it later. */}
            {/* Same ⋮ the tiles use. Three chips beside the name read as a
                toolbar and competed with the heading; a fleet's actions are
                the same kind of thing as an aircraft's, so they look it. */}
            {section.fleet && (canManageFleets || shareableFleetIds.includes(section.fleet.id)) && (
              <span
                className={`section-menu-wrap${
                  fleetMenu === section.fleet.id ? " open" : ""
                }`}
                ref={fleetMenu === section.fleet.id ? fleetMenuRef : undefined}
              >
                <button
                  className="tile-dot-btn"
                  title="Fleet options"
                  aria-label={`Options for ${section.label}`}
                  onClick={() =>
                    setFleetMenu(fleetMenu === section.fleet!.id ? null : section.fleet!.id)
                  }
                >
                  <span /><span /><span />
                </button>

                {fleetMenu === section.fleet.id && (
                  <div className="tile-dot-menu open section-dot-menu">
                    {shareableFleetIds.includes(section.fleet.id) && (
                      <button
                        className="row-dot-item"
                        onClick={() => { setFleetMenu(null); setShareFleet(section.fleet!); }}
                      >
                        Share Fleet
                      </button>
                    )}
                    {canManageFleets && (
                    <>
                    <button
                      className="row-dot-item"
                      onClick={() => {
                        setFleetMenu(null);
                        setRenameFleet(section.fleet!);
                        setRenameTo(section.fleet!.name);
                      }}
                    >
                      Rename Fleet
                    </button>
                    <button
                      className="row-dot-item danger-item"
                      onClick={() => { setFleetMenu(null); loadDeleteImpact(section.fleet!); }}
                    >
                      Delete Fleet
                    </button>
                    </>
                    )}
                  </div>
                )}
              </span>
            )}
          </h2>
          {section.sub && <div className="section-sub">{section.sub}</div>}
          {section.fleet && section.tiles.length === 0 && (
            <div className="section-sub">
              No aircraft in this fleet yet — set one&apos;s fleet in its settings.
            </div>
          )}
          <div className={`ac-cards${rearrange ? " rearrange-mode" : ""}`}>
        {section.tiles.map((a) => (
          <div
            key={a.id}
            className="ac-tile"
            style={{ opacity: dragId === a.id ? 0.4 : 1 }}
            draggable={rearrange}
            onDragStart={() => rearrange && setDragId(a.id)}
            onDragOver={(e) => rearrange && e.preventDefault()}
            onDrop={() => rearrange && onDrop(a.id)}
            onClick={() => { if (!rearrange) router.push(`/aircraft/${a.id}`); }}
            // The tile was a bare clickable div: no keyboard focus, no way in
            // without a mouse. Drag-and-drop rules out making the whole card an
            // anchor, so it announces itself as a link and answers the keys one
            // would. The registration below is a real href for new-tab opens.
            role={rearrange ? undefined : "link"}
            tabIndex={rearrange ? undefined : 0}
            onKeyDown={(e) => {
              if (rearrange) return;
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                router.push(`/aircraft/${a.id}`);
              }
            }}
          >
            {/* Was an image-shaped band holding a PRO chip and a ghosted copy of
                the registration printed again directly below it. Now it carries
                the one thing worth reading across a hangar: airworthiness. */}
            <div className="ac-tile-top">
              {airborne[a.reg] && (
                <div className="tile-airborne"><span className="tp" />LIVE</div>
              )}
              {(() => {
                const st = tileStatus(a);
                return <span className={`tile-status ${st.cls}`}>{st.label}</span>;
              })()}
            </div>

            <div className="ac-tile-body">
              <div className="ac-tile-reg">
                <Link
                  href={`/aircraft/${a.id}`}
                  onClick={(e) => e.stopPropagation()}
                  tabIndex={-1}
                  style={{ color: "inherit", textDecoration: "none" }}
                >
                  {a.reg}
                </Link>
              </div>
              <div className="ac-tile-type">{a.type ?? "—"}</div>
              <div className="ac-tile-serial">{a.serial ?? ""}</div>
            </div>

            <div className="ac-tile-foot" style={{ position: "relative" }}>
              <span className="role-badge">
                {a.craftRole ? CRAFT_ROLE_LABELS[a.craftRole] : ROLE_LABELS[a.appRole]}
              </span>
              {a.shared && (
                <span
                  className="tile-shared"
                  title={a.sharedBy ? `Shared by ${a.sharedBy}` : "Shared with you"}
                >
                  SHARED
                </span>
              )}
              {Object.values(menuFor(a)).some(Boolean) && (
                <button
                  className="tile-dot-btn"
                  title="Options"
                  aria-label={`Options for ${a.reg}`}
                  onClick={(e) => {
                    e.stopPropagation();
                    setMenu(menu === a.id ? null : a.id);
                  }}
                >
                  <span /><span /><span />
                </button>
              )}

              {menu === a.id && (
                <div
                  className="tile-dot-menu open"
                  style={{ position: "absolute", right: 0, bottom: 32 }}
                  onClick={(e) => e.stopPropagation()}
                >
                  {/* v1 listed this unconditionally, but v1's settings modal
                      also opened for anyone — openSettingsModal() had no
                      guard. v2 mounts it only for edit_settings, which is the
                      stricter and better call, so the menu item has to follow
                      or a pilot gets sent to the aircraft with nothing to
                      show for it. */}
                  {menuFor(a).settings && (
                    <button
                      className="row-dot-item"
                      onClick={() => { setMenu(null); setSettingsTile(a); }}
                    >
                      Aircraft Settings
                    </button>
                  )}
                  {/* ?access=1 only opens anything for a role that passes
                      can(role,'manage_access') in the detail page — showing it
                      to everyone meant a shared user clicked it and just
                      landed on the aircraft with no modal. */}
                  {menuFor(a).access && (
                    <button
                      className="row-dot-item"
                      onClick={() => { setMenu(null); setAccessTile(a); }}
                    >
                      Manage Access
                    </button>
                  )}

                  {menuFor(a).viewAccess && (
                    <button
                      className="row-dot-item"
                      onClick={() => { setMenu(null); setAccessTile(a); }}
                    >
                      View Access
                    </button>
                  )}

                  {/* Someone here on a grant can hand it back. There is no v1
                      equivalent — v1 only let the granter revoke — but without
                      it a shared user has no way to clear an aircraft they no
                      longer want in their hangar. */}
                  {menuFor(a).leave && (
                    <button
                      className="row-dot-item danger-item"
                      disabled={busy}
                      onClick={() => { setMenu(null); setLeaveTile(a); }}
                    >
                      Leave Aircraft
                    </button>
                  )}
                  {/* v1 omitted this entirely unless can('delete', id).
                      Someone an aircraft was shared with must not be able to
                      delete the owner's records — and RLS refuses them anyway,
                      so showing the button only produced a silent no-op. */}
                  {menuFor(a).remove && (
                    <button
                      className="row-dot-item danger-item"
                      disabled={busy}
                      onClick={() => { setMenu(null); setConfirmTile(a); }}
                    >
                      Delete Aircraft
                    </button>
                  )}
                </div>
              )}
            </div>
          </div>
        ))}
          </div>
        </div>
      ))}

      {rearrange && (
        <>
          <div className="rearrange-overlay" />
          <div className="rearrange-bar">
            <span style={{ fontSize: 13, color: "var(--muted2)" }}>Drag tiles to reorder</span>
            <button className="btn primary sm" onClick={() => setRearrange(false)}>Done</button>
          </div>
        </>
      )}

      {renameFleet && (
        <Modal title={`Rename ${renameFleet.name}`} onClose={() => setRenameFleet(null)}>
          <div className="form-row">
            <label>Name</label>
            <input
              type="text"
              value={renameTo}
              maxLength={40}
              autoFocus
              onChange={(e) => setRenameTo(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter" && !busy) renameFleetTo(renameFleet, renameTo); }}
            />
          </div>
          <div className="form-actions">
            <button className="btn-cancel" onClick={() => setRenameFleet(null)}>Cancel</button>
            <button
              className="btn-save"
              disabled={busy || !renameTo.trim() || renameTo.trim() === renameFleet.name}
              onClick={() => renameFleetTo(renameFleet, renameTo)}
            >
              {busy ? "Saving…" : "Rename"}
            </button>
          </div>
        </Modal>
      )}

      {deleteFleet && (
        <Confirm
          title="Delete fleet"
          message={
            <>
              Delete <b>{deleteFleet.name}</b>?
              {deleteImpact === null ? (
                <> Checking what this affects…</>
              ) : (
                <>
                  {" "}
                  {deleteImpact.craft > 0 ? (
                    <>
                      Its {deleteImpact.craft} aircraft stay in your hangar and
                      become ungrouped — nothing is deleted with it.
                    </>
                  ) : (
                    <>It has no aircraft in it.</>
                  )}
                  {deleteImpact.people > 0 && (
                    <>
                      {" "}
                      <b>
                        {deleteImpact.people}{" "}
                        {deleteImpact.people === 1 ? "person loses" : "people lose"} access
                      </b>{" "}
                      to {deleteImpact.craft === 1 ? "that aircraft" : "those aircraft"},
                      because their access came through this fleet.
                    </>
                  )}
                </>
              )}
            </>
          }
          confirmLabel="Delete Fleet"
          // Always, not only when someone loses access. A fleet is a container
          // for other people's aeroplanes; typing its name is the difference
          // between deciding to delete it and having deleted it.
          requireText={deleteFleet.name}
          busy={busy || deleteImpact === null}
          onConfirm={() => doDeleteFleet(deleteFleet)}
          onCancel={() => { setDeleteFleet(null); setDeleteImpact(null); }}
        />
      )}

      {shareFleet && (
        <ManageAccess
          fleetId={shareFleet.id}
          orgId={shareFleet.org_id}
          reg={`${shareFleet.name} fleet`}
          hidden
          open
          onClose={() => setShareFleet(null)}
        />
      )}

      {accessTile && (
        <ManageAccess
          aircraftId={accessTile.id}
          orgId={accessTile.org_id}
          reg={accessTile.reg}
          viaFleet={
            accessTile.fleetId
              ? fleets.find((f) => f.id === accessTile.fleetId) ?? null
              : null
          }
          hidden
          open
          readOnly={!can(accessTile.appRole, "manage_access")}
          onClose={() => setAccessTile(null)}
        />
      )}

      {settingsTile && (
        <AircraftSettings
          aircraft={{ ...settingsTile, fleet_id: settingsTile.fleetId } as unknown as AircraftRow}
          meters={settingsTile.meters}
          data={settingsTile.data}
          save={(next) => saveData(settingsTile, next)}
          hidden
          open
          onClose={() => setSettingsTile(null)}
        />
      )}

      {leaveTile && (
        <Confirm
          title="Leave aircraft"
          message={
            <>
              Remove <b>{leaveTile.reg}</b> from your hangar? You will lose
              access to its records. The owner can invite you again later.
            </>
          }
          confirmLabel="Leave Aircraft"
          busy={busy}
          onConfirm={() => leave(leaveTile)}
          onCancel={() => setLeaveTile(null)}
        />
      )}

      {confirmTile && (
        <Confirm
          title="Delete aircraft"
          message={
            <>
              Permanently delete <b>{confirmTile.reg}</b> and all of its records —
              inspections, oil, squawks, costs and flight history? This cannot be undone.
            </>
          }
          confirmLabel="Delete Aircraft"
          requireText={confirmTile.reg}
          busy={busy}
          onConfirm={() => remove(confirmTile)}
          onCancel={() => setConfirmTile(null)}
        />
      )}
    </>
  );
}
