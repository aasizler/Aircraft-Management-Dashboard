"use client";

import { useCallback, useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Modal } from "@/components/ui/modal";
import { useToast } from "@/components/ui/toast";
import { CRAFT_ROLE_COLORS, CRAFT_ROLE_LABELS } from "@/lib/permissions";
import { useAccessChanges } from "@/lib/realtime";
import { setPendingInvites } from "@/lib/aircraft-perms";
import { markSelfInitiated } from "@/lib/access-events";
import type { CraftRole } from "@/lib/types";

/**
 * The invitation ids the ribbon has been dismissed against.
 *
 * localStorage, not sessionStorage: dismissing means "I've seen these", which
 * shouldn't expire when the tab does. The ribbon returns only when an id
 * appears that isn't in this list — accepting or declining one of several
 * leaves the rest dismissed, since nothing new has arrived.
 */
const DISMISS_KEY = "aerotrack:invites-dismissed";

function readDismissed(): Set<string> {
  try {
    const raw = localStorage.getItem(DISMISS_KEY);
    return new Set(raw ? (JSON.parse(raw) as string[]) : []);
  } catch {
    return new Set();
  }
}

/** What the invitation is to, however it's addressed. */
function label(inv: { fleetName?: string | null; reg?: string | null }): string {
  return inv.fleetName ?? inv.reg ?? "an aircraft";
}

type Invite = {
  id: string;
  aircraft_id: string;
  role: CraftRole;
  invited_email: string | null;
  reg?: string | null;
  type?: string | null;
  /** Set when the invitation is to a whole fleet rather than one aircraft. */
  fleetName?: string | null;
  /** Who sent it. Name leads; the address is the confirmation. */
  fromName?: string | null;
  fromEmail?: string | null;
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
  // Mounted in the root layout so the modal is reachable everywhere, but the
  // reminder belongs on the hangar only.
  const onHangar = usePathname() === "/";
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
        "id, aircraft_id, role, invited_email, aircraft_reg, aircraft_type, fleet_id, fleet_name, granted_by_name, granted_by_email",
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
      fleet_id: string | null;
      fleet_name: string | null;
      granted_by_name: string | null;
      granted_by_email: string | null;
    };

    const rows = (data ?? []) as unknown as Row[];
    // Only an id that wasn't dismissed counts as new. Comparing the whole set
    // meant declining one of several re-raised the ribbon for the others,
    // which isn't a new invitation — it's the same ones, minus one.
    const seen = readDismissed();
    const arrived = rows.some((r) => !seen.has(r.id));
    if (arrived) localStorage.removeItem(DISMISS_KEY);
    setDismissed(!!rows.length && !arrived && seen.size > 0);

    setPendingInvites(rows.length);
    setInvites(
      rows.map((r) => ({
        id: r.id,
        aircraft_id: r.aircraft_id,
        role: r.role,
        invited_email: r.invited_email,
        reg: r.aircraft_reg,
        type: r.aircraft_type,
        fleetName: r.fleet_name,
        fromName: r.granted_by_name,
        fromEmail: r.granted_by_email,
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

  useEffect(() => () => setPendingInvites(0), []);

  // The "Review" action on the invitation toast opens this. Un-dismisses the
  // banner too — having hidden it once shouldn't make the modal unreachable.
  useEffect(() => {
    // Deliberately does NOT clear the dismissal: reviewing the list and
    // closing it shouldn't put the ribbon back. You dismissed it; looking at
    // the invitations is not un-dismissing them.
    const open = () => setOpen(true);
    window.addEventListener("aerotrack:pending-invites", open);
    return () => window.removeEventListener("aerotrack:pending-invites", open);
  }, []);

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
    toast(`You now have access to ${label(inv)}`, "ok");
    router.refresh();
  }

  async function decline(inv: Invite) {
    setBusy(true);
    // Declining and being revoked are the same DELETE on the wire. Without
    // this the watcher also announced "Your access has been revoked" — two
    // toasts for one action, one of them untrue.
    markSelfInitiated(inv.id);
    const { data, error } = await createClient()
      .rpc("decline_aircraft_access", { p_access: inv.id });
    setBusy(false);
    if (error) { toast(`Could not decline: ${error.message}`, "danger"); return; }
    if (!data) { toast("That invitation is no longer available.", "danger"); load(); return; }
    setInvites((v) => v.filter((x) => x.id !== inv.id));
    toast("Invite declined", "ok");
    router.refresh();
  }

  if (!invites.length) return null;

  const count = invites.length;
  // Two kinds of invitation, and they aren't interchangeable: one hands over a
  // single aeroplane, the other every aeroplane in a fleet plus anything added
  // to it later. Shown apart so nobody accepts the second thinking it's the
  // first.
  const fleetInvites = invites.filter((i) => i.fleetName);
  const craftInvites = invites.filter((i) => !i.fleetName);

  const renderInvite = (inv: Invite) => (
    <div className="invite-card" key={inv.id}>
      <div className="invite-head">
        {inv.fleetName ? "Fleet Invitation" : "Aircraft Invitation"}
      </div>
      <div className="invite-craft">
        {inv.fleetName
          ? inv.fleetName
          : inv.reg && inv.type
            ? `${inv.reg} — ${inv.type}`
            : inv.reg ?? "Aircraft invitation"}
      </div>
      {/* Says what accepting actually hands over. A fleet is open-ended —
          anything filed into it later comes too — and that's worth knowing
          before you accept rather than after. */}
      {inv.fleetName && (
        <div className="invite-meta">
          Every aircraft in this fleet, including ones added later
        </div>
      )}
      {(inv.fromName || inv.fromEmail) && (
        <>
          <div className="invite-meta">
            From: <b>{inv.fromName?.trim() || inv.fromEmail}</b>
          </div>
          {inv.fromName?.trim() && inv.fromEmail && (
            <div className="invite-email">{inv.fromEmail}</div>
          )}
        </>
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
  );

  return (
    <>
      {/* Dismissing the ribbon shouldn't mean forgetting. A quiet line on the
          hangar keeps the invitations one click away without putting the full
          banner back every time you return to the page. */}
      {dismissed && onHangar && (
        <div className="pending-hint">
          You have {count} pending invitation{count > 1 ? "s" : ""} ·{" "}
          <button className="auth-link" onClick={() => setOpen(true)}>
            Review
          </button>
        </div>
      )}

      {!dismissed && (
      <div className="pending-banner">
        <span className="pending-icon">✉️</span>
        <div className="pending-main">
          <div className="pending-title">
            {invites.length === 1
              ? `You've been invited to ${label(invites[0])}`
              : `${invites.length} pending invitations`}
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
          onClick={() => {
            localStorage.setItem(DISMISS_KEY, JSON.stringify(invites.map((i) => i.id)));
            setDismissed(true);
          }}
          aria-label="Dismiss"
        >
          ×
        </button>
      </div>
      )}

      {open && (
        <Modal title="Pending Invites" onClose={() => setOpen(false)}>
          {/* Card per invite, laid out as v1's openPendingInvitesModal did:
              heading, REG — TYPE in accent mono, who sent it, then the role in
              its own colour. */}
          {fleetInvites.length > 0 && (
            <>
              <div className="form-divider" style={{ borderTop: "none", marginTop: 0 }}>
                Fleets
              </div>
              {fleetInvites.map(renderInvite)}
            </>
          )}

          {craftInvites.length > 0 && (
            <>
              <div className="form-divider" style={fleetInvites.length ? undefined : { borderTop: "none", marginTop: 0 }}>
                Aircraft
              </div>
              {craftInvites.map(renderInvite)}
            </>
          )}

          <div className="form-actions">
            <button className="btn-cancel" onClick={() => setOpen(false)}>Close</button>
          </div>
        </Modal>
      )}
    </>
  );
}
