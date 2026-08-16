"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Modal } from "@/components/ui/modal";
import { useToast } from "@/components/ui/toast";
import { CRAFT_ROLE_COLORS, CRAFT_ROLE_LABELS } from "@/lib/permissions";
import { useAccessChanges } from "@/lib/realtime";
import type { CraftRole } from "@/lib/types";

type Invite = {
  id: string;
  aircraft_id: string;
  role: CraftRole;
  invited_email: string | null;
  reg?: string | null;
  type?: string | null;
  from?: string | null;
};

/**
 * Pending-invite banner + modal, ported from v1's checkPendingInvites(),
 * showPendingBanner(), hidePendingBanner(), acceptInvite(), declineInvite(),
 * openPendingInvitesModal() and resolveEmailInvites().
 *
 * An invite is a row in aircraft_access with accepted = false. It grants
 * nothing until accepted — same as v1, whose fleet policy required
 * aircraft_shares.accepted = true. An earlier version of this file assumed RLS
 * granted access on the email match alone, which made Accept decoration and
 * Decline a no-op that still reported success.
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
    // Pending is `accepted = false`, matching v1's checkPendingInvites().
    // The aircraft identity is denormalized onto the grant because an
    // unaccepted invite can't read the aircraft row — joining aircraft(reg)
    // returns null and the banner falls back to a uuid.
    const { data } = await supabase
      .from("aircraft_access")
      .select(
        "id, aircraft_id, role, invited_email, aircraft_reg, aircraft_type, granted_by_email",
      )
      .eq("accepted", false)
      .ilike("invited_email", email);

    type Row = {
      id: string;
      aircraft_id: string;
      role: CraftRole;
      invited_email: string | null;
      aircraft_reg: string | null;
      aircraft_type: string | null;
      granted_by_email: string | null;
    };

    setInvites(
      ((data ?? []) as unknown as Row[]).map((r) => ({
        id: r.id,
        aircraft_id: r.aircraft_id,
        role: r.role,
        invited_email: r.invited_email,
        reg: r.aircraft_reg,
        type: r.aircraft_type,
        from: r.granted_by_email,
      })),
    );
  }, [email]);

  // Fetching remote rows on mount — the state update is the point of the
  // effect, not a render-phase side effect.
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { load(); }, [load]);

  // A grant made while this tab is open should raise the banner on its own.
  // AccessWatcher's router.refresh() re-runs server components but never
  // re-fires this effect, so the invite sat unseen until a manual reload.
  useAccessChanges(load);

  // Both go through RPCs. Writing aircraft_access directly matched zero rows —
  // the table's only write policy is is_org_staff() — and RLS filters rather
  // than raising, so the old code reported success while changing nothing.
  // The functions return false when nothing matched; treat that as a failure.
  async function accept(inv: Invite) {
    setBusy(true);
    const { data, error } = await createClient()
      .rpc("claim_aircraft_access", { p_access: inv.id });
    setBusy(false);
    if (error) { toast(`Could not accept: ${error.message}`, "danger"); return; }
    if (!data) { toast("That invitation is no longer available.", "danger"); load(); return; }
    setInvites((v) => v.filter((x) => x.id !== inv.id));
    toast(`You now have access to ${inv.reg ?? "this aircraft"}`, "ok");
    router.refresh();
  }

  async function decline(inv: Invite) {
    setBusy(true);
    const { data, error } = await createClient()
      .rpc("decline_aircraft_access", { p_access: inv.id });
    setBusy(false);
    if (error) { toast(`Could not decline: ${error.message}`, "danger"); return; }
    if (!data) { toast("That invitation is no longer available.", "danger"); load(); return; }
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
              ? `As ${CRAFT_ROLE_LABELS[invites[0].role]}`
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
          {/* Card per invite, laid out as v1's openPendingInvitesModal did:
              heading, REG — TYPE in accent mono, who sent it, then the role in
              its own colour. */}
          {invites.map((inv) => (
              <div className="invite-card" key={inv.id}>
                <div className="invite-head">Aircraft Invitation</div>
                <div className="invite-craft">
                  {inv.reg && inv.type
                    ? `${inv.reg} — ${inv.type}`
                    : inv.reg ?? "Aircraft invitation"}
                </div>
                {inv.from && (
                  <div className="invite-meta">
                    From: <b>{inv.from}</b>
                  </div>
                )}
                <div className="invite-meta mono">
                  Role:{" "}
                  <b style={{ color: CRAFT_ROLE_COLORS[inv.role] }}>
                    {CRAFT_ROLE_LABELS[inv.role]}
                  </b>
                </div>
                <div className="invite-actions">
                  <button className="btn sm primary" disabled={busy} onClick={() => accept(inv)}>
                    Accept
                  </button>
                  <button className="btn sm" disabled={busy} onClick={() => decline(inv)}>
                    Decline
                  </button>
                </div>
              </div>
          ))}
          <div className="form-actions">
            <button className="btn-cancel" onClick={() => setOpen(false)}>Close</button>
          </div>
        </Modal>
      )}
    </>
  );
}
