"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { useToast } from "@/components/ui/toast";

/**
 * Sets the name other people see.
 *
 * Signup captured full_name and then nothing could change it, which stopped
 * mattering only while names were invisible. Now that notifications and the
 * access list show them, an account created without one is stuck reading as a
 * bare email address to everyone it shares an aircraft with.
 */
export function DisplayName({ initial }: { initial?: string | null }) {
  const router = useRouter();
  const toast = useToast();
  const [name, setName] = useState(initial ?? "");
  const [busy, setBusy] = useState(false);

  const dirty = name.trim() !== (initial ?? "").trim();

  async function save() {
    setBusy(true);
    const { error } = await createClient().auth.updateUser({
      data: { full_name: name.trim() || null },
    });
    setBusy(false);
    if (error) { toast(`Could not save: ${error.message}`, "danger"); return; }
    toast("Display name saved", "ok");
    router.refresh();
  }

  return (
    <div className="panel">
      <div className="panel-title">Display name</div>
      <div className="panel-note">
        How you appear to people you share aircraft with. Without one they see
        your email address instead.
      </div>
      <div className="form-row">
        <input
          type="text"
          value={name}
          maxLength={60}
          placeholder="Your name"
          onChange={(e) => setName(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter" && dirty && !busy) save(); }}
        />
      </div>
      <div className="form-actions">
        <button className="btn-save" onClick={save} disabled={!dirty || busy}>
          {busy ? "Saving…" : "Save name"}
        </button>
      </div>
      {/* Grants stamp the name in place when they're created or accepted, so a
          rename doesn't rewrite history. Say so rather than let it surprise. */}
      <div className="panel-note" style={{ marginTop: 6 }}>
        Aircraft you already share keep the name recorded at the time.
      </div>
    </div>
  );
}
