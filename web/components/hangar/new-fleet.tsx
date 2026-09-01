"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Modal } from "@/components/ui/modal";
import { useToast } from "@/components/ui/toast";

/**
 * Creates a fleet — a named section of the hangar that aircraft can be filed
 * under, and that access can be granted against as a whole.
 *
 * Staff only, since fleets write is is_org_staff(). An owner with one aeroplane
 * never needs one, which is why this sits beside Add Aircraft rather than in
 * front of it.
 */
export function NewFleetButton({ orgId }: { orgId: string }) {
  const router = useRouter();
  const toast = useToast();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function create() {
    const n = name.trim();
    if (!n) { setErr("Give the fleet a name."); return; }
    setBusy(true);
    setErr(null);
    const { error } = await createClient()
      .from("fleets")
      .insert({ org_id: orgId, name: n });
    setBusy(false);
    if (error) {
      // The unique index is on (org_id, lower(name)).
      setErr(error.code === "23505" ? "You already have a fleet with that name." : error.message);
      return;
    }
    setOpen(false);
    setName("");
    toast(`${n} created — set an aircraft's fleet in its settings`, "ok");
    router.refresh();
  }

  return (
    <>
      <button className="btn" onClick={() => setOpen(true)}>
        + New Fleet
      </button>

      {open && (
        <Modal title="New fleet" onClose={() => setOpen(false)}>
          <div style={{ fontSize: 13, color: "var(--muted3)", lineHeight: 1.7 }}>
            A fleet groups aircraft into their own section of the hangar. You
            can share a whole fleet with someone, and anything you add to it
            later comes with it.
          </div>
          <div className="form-row" style={{ marginTop: 14 }}>
            <label>Name</label>
            <input
              type="text"
              value={name}
              maxLength={40}
              autoFocus
              placeholder="e.g. Charter"
              onChange={(e) => { setName(e.target.value); setErr(null); }}
              onKeyDown={(e) => { if (e.key === "Enter" && !busy) create(); }}
            />
          </div>
          {err && <div className="grant-msg warn">{err}</div>}
          <div className="form-actions">
            <button className="btn-cancel" onClick={() => setOpen(false)}>Cancel</button>
            <button className="btn-save" onClick={create} disabled={busy}>
              {busy ? "Creating…" : "Create fleet"}
            </button>
          </div>
        </Modal>
      )}
    </>
  );
}
