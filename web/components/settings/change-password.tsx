"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { useToast } from "@/components/ui/toast";

// Ports v1's submitNewPassword(). The reset email lands on /auth/callback,
// which exchanges the recovery code and forwards here, so this is where a
// recovering user sets the new password.
export function ChangePassword() {
  const toast = useToast();
  const [open, setOpen] = useState(false);
  const [pw, setPw] = useState("");
  const [pw2, setPw2] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit() {
    if (pw.length < 8) { toast("Use at least 8 characters.", "warn"); return; }
    if (pw !== pw2) { toast("Passwords do not match.", "warn"); return; }
    setBusy(true);
    const { error } = await createClient().auth.updateUser({ password: pw });
    setBusy(false);
    if (error) { toast(error.message, "danger"); return; }
    setPw(""); setPw2(""); setOpen(false);
    toast("Password updated", "ok");
  }

  if (!open) {
    return (
      <button className="btn sm" onClick={() => setOpen(true)}>
        Change password
      </button>
    );
  }

  return (
    <div style={{ marginTop: 10 }}>
      <div className="form-row">
        <label>New password</label>
        <input type="password" value={pw} onChange={(e) => setPw(e.target.value)} autoComplete="new-password" />
      </div>
      <div className="form-row">
        <label>Confirm new password</label>
        <input type="password" value={pw2} onChange={(e) => setPw2(e.target.value)} autoComplete="new-password" />
      </div>
      <div style={{ display: "flex", gap: 8 }}>
        <button className="btn-cancel" onClick={() => { setOpen(false); setPw(""); setPw2(""); }}>
          Cancel
        </button>
        <button className="btn-save" onClick={submit} disabled={busy}>
          {busy ? "Saving…" : "Update password"}
        </button>
      </div>
    </div>
  );
}
