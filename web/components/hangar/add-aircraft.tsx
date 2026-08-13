"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Modal } from "@/components/ui/modal";
import type { MeterKind } from "@/lib/types";

const METERS: MeterKind[] = ["hobbs", "tach", "flight", "total"];

export function AddAircraftButton({ orgId }: { orgId: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [f, setF] = useState({
    reg: "",
    type: "",
    serial: "",
    airport: "",
    maint_basis: "hobbs" as MeterKind,
    cost_basis: "hobbs" as MeterKind,
    hours: "",
  });

  const set = (k: keyof typeof f, v: string) => setF((p) => ({ ...p, [k]: v }));

  async function submit() {
    if (!f.reg.trim()) {
      setErr("Registration is required.");
      return;
    }
    setBusy(true);
    setErr(null);
    const supabase = createClient();
    const { data: ac, error } = await supabase
      .from("aircraft")
      .insert({
        org_id: orgId,
        reg: f.reg.trim().toUpperCase(),
        type: f.type.trim() || null,
        serial: f.serial.trim() || null,
        airport: f.airport.trim() || null,
        maint_basis: f.maint_basis,
        cost_basis: f.cost_basis,
        data: {},
      })
      .select("id")
      .single();

    if (error || !ac) {
      setErr(error?.message ?? "Could not create aircraft.");
      setBusy(false);
      return;
    }

    // Seed the meters the airframe carries (maint + cost bases; deduped).
    const kinds = Array.from(new Set([f.maint_basis, f.cost_basis]));
    const hrs = f.hours ? Number(f.hours) : 0;
    await supabase
      .from("aircraft_meters")
      .insert(kinds.map((kind) => ({ aircraft_id: ac.id, kind, current: hrs })));

    setBusy(false);
    setOpen(false);
    setF({ reg: "", type: "", serial: "", airport: "", maint_basis: "hobbs", cost_basis: "hobbs", hours: "" });
    router.refresh();
  }

  return (
    <>
      <button className="btn primary" onClick={() => setOpen(true)}>
        + Add Aircraft
      </button>

      {open && (
        <Modal title="Add Aircraft" onClose={() => setOpen(false)}>
          <div className="form-grid">
            <div className="form-row">
              <label>Registration *</label>
              <input value={f.reg} onChange={(e) => set("reg", e.target.value)} placeholder="N137BF" />
            </div>
            <div className="form-row">
              <label>Serial</label>
              <input value={f.serial} onChange={(e) => set("serial", e.target.value)} placeholder="E-3999" />
            </div>
          </div>
          <div className="form-row">
            <label>Type</label>
            <input value={f.type} onChange={(e) => set("type", e.target.value)} placeholder="Beechcraft Bonanza G36" />
          </div>
          <div className="form-row">
            <label>Base Airport</label>
            <input value={f.airport} onChange={(e) => set("airport", e.target.value)} placeholder="KPIE" />
          </div>
          <div className="form-grid">
            <div className="form-row">
              <label>Maintenance clock</label>
              <select value={f.maint_basis} onChange={(e) => set("maint_basis", e.target.value)}>
                {METERS.map((m) => <option key={m} value={m}>{m}</option>)}
              </select>
            </div>
            <div className="form-row">
              <label>Cost clock</label>
              <select value={f.cost_basis} onChange={(e) => set("cost_basis", e.target.value)}>
                {METERS.map((m) => <option key={m} value={m}>{m}</option>)}
              </select>
            </div>
          </div>
          <div className="form-row">
            <label>Current hours</label>
            <input type="number" step="0.1" value={f.hours} onChange={(e) => set("hours", e.target.value)} placeholder="1243" />
          </div>
          {err && <div className="auth-err">{err}</div>}
          <div className="form-actions">
            <button className="btn-cancel" onClick={() => setOpen(false)}>Cancel</button>
            <button className="btn-save" onClick={submit} disabled={busy}>
              {busy ? "Creating…" : "Add Aircraft"}
            </button>
          </div>
        </Modal>
      )}
    </>
  );
}
