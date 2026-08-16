"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Modal } from "@/components/ui/modal";
import { useToast } from "@/components/ui/toast";

/**
 * First run for an account that belongs to no organisation.
 *
 * Without this a new sign-up was a dead end: Add Aircraft only renders for a
 * member of an org, and nothing in the app created one. The only way in was
 * for someone else to share an aircraft with you.
 *
 * Goes through create_org() rather than inserting directly — the org and
 * members policies deadlock for a non-member, so the client cannot do both
 * halves itself.
 */
export function CreateOrg({ suggested }: { suggested?: string | null }) {
  const router = useRouter();
  const toast = useToast();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState(suggested?.trim() ? `${suggested.trim()}'s Hangar` : "");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function create() {
    const n = name.trim();
    if (!n) { setErr("Give your hangar a name."); return; }
    setBusy(true);
    setErr(null);
    const { error } = await createClient().rpc("create_org", { p_name: n });
    setBusy(false);
    if (error) { setErr(error.message); return; }
    setOpen(false);
    toast(`${n} created — you can add aircraft now`, "ok");
    router.refresh();
  }

  return (
    <>
      <button className="btn primary" onClick={() => setOpen(true)}>
        Create your hangar
      </button>

      {open && (
        <Modal title="Create your hangar" onClose={() => setOpen(false)}>
          <div style={{ fontSize: 13, color: "var(--muted3)", lineHeight: 1.7 }}>
            Your aircraft live in a hangar you own. Name it after yourself or
            after your operation — you can share individual aircraft with other
            people afterwards.
          </div>
          <div className="form-row" style={{ marginTop: 14 }}>
            <label>Name</label>
            <input
              type="text"
              value={name}
              maxLength={60}
              autoFocus
              placeholder="e.g. Hired Wings"
              onChange={(e) => { setName(e.target.value); setErr(null); }}
              onKeyDown={(e) => { if (e.key === "Enter" && !busy) create(); }}
            />
          </div>
          {err && <div className="grant-msg warn">{err}</div>}
          <div className="form-actions">
            <button className="btn-cancel" onClick={() => setOpen(false)}>Cancel</button>
            <button className="btn-save" onClick={create} disabled={busy}>
              {busy ? "Creating…" : "Create hangar"}
            </button>
          </div>
        </Modal>
      )}
    </>
  );
}
