"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Modal } from "@/components/ui/modal";
import { useToast } from "@/components/ui/toast";
import { ROLE_LABELS, resolveRole } from "@/lib/permissions";
import type { CraftRole } from "@/lib/types";

type Invite = {
  id: string;
  aircraft_id: string;
  role: CraftRole;
  invited_email: string | null;
  reg?: string | null;
};

/**
 * Pending-invite banner + modal, ported from v1's checkPendingInvites(),
 * showPendingBanner(), hidePendingBanner(), acceptInvite(), declineInvite(),
 * openPendingInvitesModal() and resolveEmailInvites().
 *
 * In v2 an invite is a row in aircraft_access matched on invited_email. RLS
 * already grants access the moment the invitee signs in with that address, so
 * "accept" here claims the row (stamps user_id) and "decline" deletes it —
 * which is what makes the grant visible/revocable to the granter either way.
 */
export function PendingInvites({ email }: { email: string }) {
  const router = useRouter();
  const toast = useToast();
  const [invites, setInvites] = useState<Invite[]>([]);
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [dismissed, setDismissed] = useState(false);

  const load = useCallback(async () => {
    const supabase = createClient();
    const { data } = await supabase
      .from("aircraft_access")
      .select("id, aircraft_id, role, invited_email, aircraft(reg)")
      .is("user_id", null)
      .ilike("invited_email", email);

    setInvites(
      ((data ?? []) as unknown as (Invite & { aircraft?: { reg?: string } })[]).map((r) => ({
        id: r.id,
        aircraft_id: r.aircraft_id,
        role: r.role,
        invited_email: r.invited_email,
        reg: r.aircraft?.reg ?? null,
      })),
    );
  }, [email]);

  // Fetching remote rows on mount — the state update is the point of the
  // effect, not a render-phase side effect.
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { load(); }, [load]);

  async function accept(inv: Invite) {
    setBusy(true);
    const supabase = createClient();
    const { data: auth } = await supabase.auth.getUser();
    const { error } = await supabase
      .from("aircraft_access")
      .update({ user_id: auth.user?.id })
      .eq("id", inv.id);
    setBusy(false);
    if (error) { toast(`Could not accept: ${error.message}`, "danger"); return; }
    setInvites((v) => v.filter((x) => x.id !== inv.id));
    toast(`You now have access to ${inv.reg ?? "this aircraft"}`, "ok");
    router.refresh();
  }

  async function decline(inv: Invite) {
    setBusy(true);
    const { error } = await createClient()
      .from("aircraft_access").delete().eq("id", inv.id);
    setBusy(false);
    if (error) { toast(`Could not decline: ${error.message}`, "danger"); return; }
    setInvites((v) => v.filter((x) => x.id !== inv.id));
    toast("Invite declined", "ok");
    router.refresh();
  }

  if (!invites.length || dismissed) return null;

  return (
    <>
      <div className="pending-banner">
        <span className="pending-icon">✉️</span>
        <div className="pending-main">
          <div className="pending-title">
            {invites.length === 1
              ? `You've been invited to ${invites[0].reg ?? "an aircraft"}`
              : `${invites.length} pending aircraft invites`}
          </div>
          <div className="pending-sub">
            {invites.length === 1
              ? `As ${ROLE_LABELS[resolveRole(null, invites[0].role)]}`
              : "Review who has invited you"}
          </div>
        </div>
        <button className="btn sm primary" onClick={() => setOpen(true)}>Review</button>
        <button
          className="pending-x"
          onClick={() => setDismissed(true)}
          aria-label="Dismiss"
        >
          ×
        </button>
      </div>

      {open && (
        <Modal title="Pending Invites" onClose={() => setOpen(false)}>
          <ul className="doc-list">
            {invites.map((inv) => (
              <li className="doc-item" key={inv.id}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div className="doc-name">{inv.reg ?? inv.aircraft_id.slice(0, 8)}</div>
                  <div className="doc-meta">
                    {ROLE_LABELS[resolveRole(null, inv.role)]}
                  </div>
                </div>
                <button className="action-btn" disabled={busy} onClick={() => accept(inv)}>
                  Accept
                </button>
                <button className="action-btn del" disabled={busy} onClick={() => decline(inv)}>
                  Decline
                </button>
              </li>
            ))}
          </ul>
          <div className="form-actions">
            <button className="btn-cancel" onClick={() => setOpen(false)}>Close</button>
          </div>
        </Modal>
      )}
    </>
  );
}
