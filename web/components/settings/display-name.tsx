"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { useToast } from "@/components/ui/toast";

/**
 * Sets the name other people see.
 *
 * Signup captured a name and then nothing could change it, which stopped
 * mattering only while names were invisible. Now that notifications and the
 * access list show them, an account created without one reads as a bare email
 * address to everyone it shares an aircraft with.
 *
 * Stored as first_name / last_name, with full_name kept as the composed value
 * because that is what everything else reads — grant stamping, the initials on
 * a toast, the access list.
 */
export function DisplayName({
  firstInitial,
  lastInitial,
  fullInitial,
}: {
  firstInitial?: string | null;
  lastInitial?: string | null;
  /** Pre-split accounts only carry a full name; seed the boxes from it. */
  fullInitial?: string | null;
}) {
  const router = useRouter();
  const toast = useToast();

  const seeded = (() => {
    if (firstInitial || lastInitial) {
      return { f: firstInitial ?? "", l: lastInitial ?? "" };
    }
    const parts = (fullInitial ?? "").trim().split(/\s+/).filter(Boolean);
    if (!parts.length) return { f: "", l: "" };
    return { f: parts[0], l: parts.slice(1).join(" ") };
  })();

  const [first, setFirst] = useState(seeded.f);
  const [last, setLast] = useState(seeded.l);
  const [busy, setBusy] = useState(false);

  const f = first.trim();
  const l = last.trim();
  const complete = !!f && !!l;
  const dirty = f !== seeded.f.trim() || l !== seeded.l.trim();

  async function save() {
    if (!complete) return;
    setBusy(true);
    const { error } = await createClient().auth.updateUser({
      data: { first_name: f, last_name: l, full_name: `${f} ${l}` },
    });
    setBusy(false);
    if (error) { toast(`Could not save: ${error.message}`, "danger"); return; }
    toast("Name saved", "ok");
    router.refresh();
  }

  return (
    <div className="panel">
      <div className="panel-title">Your name</div>
      <div className="panel-note">
        How you appear to people you share aircraft with. Without it they see
        your email address instead.
      </div>

      <div className="auth-split" style={{ marginBottom: 10 }}>
        <input
          type="text"
          value={first}
          maxLength={40}
          placeholder="First name"
          autoComplete="given-name"
          onChange={(e) => setFirst(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter" && dirty && complete && !busy) save(); }}
        />
        <input
          type="text"
          value={last}
          maxLength={40}
          placeholder="Last name"
          autoComplete="family-name"
          onChange={(e) => setLast(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter" && dirty && complete && !busy) save(); }}
        />
      </div>

      <div className="form-actions">
        <button className="btn-save" onClick={save} disabled={!dirty || !complete || busy}>
          {busy ? "Saving…" : "Save name"}
        </button>
      </div>

      {/* Grants stamp the name in place when created or accepted, so a rename
          doesn't rewrite history. Say so rather than let it surprise. */}
      <div className="panel-note" style={{ marginTop: 6 }}>
        Aircraft you already share keep the name recorded at the time.
      </div>
    </div>
  );
}
