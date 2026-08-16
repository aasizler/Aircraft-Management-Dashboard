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
};

export function HangarGrid({ aircraft }: { aircraft: Tile[] }) {
  const router = useRouter();
  const toast = useToast();
  const [menu, setMenu] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [order, setOrder] = useState<Tile[]>(aircraft);
  const [dragId, setDragId] = useState<string | null>(null);
  const [confirmTile, setConfirmTile] = useState<Tile | null>(null);
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

              {menu === a.id && (
                <div
                  className="tile-dot-menu open"
                  style={{ position: "absolute", right: 0, bottom: 32 }}
                  onClick={(e) => e.stopPropagation()}
                >
                  <button
                    className="row-dot-item"
                    onClick={() => router.push(`/aircraft/${a.id}?settings=1`)}
                  >
                    Aircraft Settings
                  </button>
                  <button
                    className="row-dot-item"
                    onClick={() => router.push(`/aircraft/${a.id}?access=1`)}
                  >
                    Manage Access
                  </button>
                  {/* v1 omitted this entirely unless can('delete', id).
                      Someone an aircraft was shared with must not be able to
                      delete the owner's records — and RLS refuses them anyway,
                      so showing the button only produced a silent no-op. */}
                  {can(a.appRole, "delete") && (
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
