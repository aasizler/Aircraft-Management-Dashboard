"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { useFleetAirborne } from "@/lib/adsb";
import { ic, meterValue, type Insp, type Meter, type V1Aircraft } from "@/lib/aircraft";
import { Confirm } from "@/components/ui/confirm";
import { useToast } from "@/components/ui/toast";
import { ROLE_LABELS, can, type AppRole } from "@/lib/permissions";
import type { MeterKind } from "@/lib/types";

export type Tile = {
  id: string;
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
};

export function HangarGrid({ aircraft }: { aircraft: Tile[] }) {
  const router = useRouter();
  const toast = useToast();
  const [menu, setMenu] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [order, setOrder] = useState<Tile[]>(aircraft);
  const [dragId, setDragId] = useState<string | null>(null);
  const [confirmTile, setConfirmTile] = useState<Tile | null>(null);
  const [leaveTile, setLeaveTile] = useState<Tile | null>(null);
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
    };
  }

  /** Health dot, exactly as v1 computed it: red overdue, amber due-soon, else green. */
  function statusDot(t: Tile) {
    const hrs = meterValue(t.meters, t.maint_basis);
    const active = ((t.data?.inspections ?? []) as Insp[]).filter((i) => !i.inactive);
    const scored = active.map((i) => ic(i, hrs).s);
    if (scored.includes("overdue")) return "#f04b4b";
    if (scored.includes("warn")) return "#f59e0b";
    return "#2dd4a0";
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

  async function onDrop(targetId: string) {
    if (!dragId || dragId === targetId) return;
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

  return (
    <>
      <div className={`ac-cards${rearrange ? " rearrange-mode" : ""}`}>
        {order.map((a) => (
          <div
            key={a.id}
            className="ac-tile"
            style={{ opacity: dragId === a.id ? 0.4 : 1 }}
            draggable={rearrange}
            onDragStart={() => rearrange && setDragId(a.id)}
            onDragOver={(e) => rearrange && e.preventDefault()}
            onDrop={() => rearrange && onDrop(a.id)}
            onClick={() => { if (!rearrange) router.push(`/aircraft/${a.id}`); }}
          >
            <div className="ac-tile-top">
              <div className="ac-tile-pro">PRO</div>
              {airborne[a.reg] && (
                <div className="tile-airborne"><span className="tp" />LIVE</div>
              )}
              <div className="tile-reg-ghost">{a.reg}</div>
              <div className="tile-status-dot" style={{ background: statusDot(a) }} />
            </div>

            <div className="ac-tile-body">
              <div className="ac-tile-reg">{a.reg}</div>
              <div className="ac-tile-type">{a.type ?? "—"}</div>
              <div className="ac-tile-serial">{a.serial ?? ""}</div>
            </div>

            <div className="ac-tile-foot" style={{ position: "relative" }}>
              <span className="role-badge">{ROLE_LABELS[a.appRole]}</span>
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
                      onClick={() => router.push(`/aircraft/${a.id}?settings=1`)}
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
                      onClick={() => router.push(`/aircraft/${a.id}?access=1`)}
                    >
                      Manage Access
                    </button>
                  )}

                  {/* Someone here on a grant can hand it back. There is no v1
                      equivalent — v1 only let the granter revoke — but without
                      it a shared user has no way to clear an aircraft they no
                      longer want in their hangar. */}
                  {menuFor(a).leave && (
                    <button
                      className="row-dot-item"
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

      {rearrange && (
        <>
          <div className="rearrange-overlay" />
          <div className="rearrange-bar">
            <span style={{ fontSize: 13, color: "var(--muted2)" }}>Drag tiles to reorder</span>
            <button className="btn primary sm" onClick={() => setRearrange(false)}>Done</button>
          </div>
        </>
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
