"use client";

import { useCallback, useEffect, useRef, useState, useTransition } from "react";
import { usePathname, useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { useAccessChanges, type AccessEvent, type AccessRow } from "@/lib/realtime";
import { wasSelfInitiated } from "@/lib/access-events";
import { useToast } from "@/components/ui/toast";
import { Modal } from "@/components/ui/modal";
import { CRAFT_ROLE_LABELS } from "@/lib/permissions";

/**
 * Watches access grants for the whole signed-in session, mounted once in the
 * root layout so it covers every authenticated page.
 *
 * Ported from v1's handleRealtimeSharesUpdate(): who accepted, who declined,
 * whose access was pulled. v1 narrated all of it; the port had gone silent and
 * merely refreshed.
 *
 * The awkward part is DELETE. Postgres sends only the primary key in `old`
 * unless the table is REPLICA IDENTITY FULL, and Supabase does not apply RLS to
 * delete payloads, so the row's own columns can't be relied on. A first attempt
 * read `old.invited_email` and `old.aircraft_id` directly, which meant a
 * revoked user failed the "is this mine?" test and got told they had DECLINED
 * their own invitation — and, because the aircraft id was missing too, the
 * page refreshed into a 404 instead of showing the explanation.
 *
 * So every grant this session can see is cached by id, and a delete is resolved
 * against that cache. `old.id` is the one field always present.
 */
/** Display name, falling back to the address when nobody set one. */
function who(name?: string | null, email?: string | null): string {
  return name?.trim() || email || "Someone";
}

export function AccessWatcher({
  userId,
  email,
}: {
  userId?: string | null;
  email?: string | null;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const toast = useToast();
  const [lost, setLost] = useState<string | null>(null);
  const [leaving, startLeaving] = useTransition();
  // Where they were standing when access was pulled. The dialog comes down
  // only once the route has actually changed.
  const lostAt = useRef<string | null>(null);
  const cache = useRef<Map<string, Partial<AccessRow>>>(new Map());

  const refreshCache = useCallback(async () => {
    const { data } = await createClient()
      .from("aircraft_access")
      .select(
        "id, aircraft_id, user_id, invited_email, role, accepted, aircraft_reg, granted_by_name, granted_by_email, user_name",
      );
    cache.current = new Map(
      ((data ?? []) as Partial<AccessRow>[]).map((r) => [r.id as string, r]),
    );
  }, []);

  useEffect(() => { refreshCache(); }, [refreshCache]);

  const isMine = useCallback(
    (row: Partial<AccessRow> | null | undefined) =>
      !!row &&
      ((!!userId && row.user_id === userId) ||
        (!!email &&
          !!row.invited_email &&
          row.invited_email.toLowerCase() === email.toLowerCase())),
    [userId, email],
  );

  const onAccess = useCallback(
    (e: AccessEvent) => {
      if (e.eventType === "INSERT" && isMine(e.new)) {
        const from = who(e.new?.granted_by_name, e.new?.granted_by_email);
        toast(
          {
            title: from,
            who: from,
            reg: e.new?.aircraft_reg ?? undefined,
            detail: `Invited you as ${
              e.new?.role ? CRAFT_ROLE_LABELS[e.new.role] : "a collaborator"
            }`,
            actions: [
              {
                label: "Review",
                primary: true,
                // PendingInvites owns the modal; it listens for this.
                onClick: () =>
                  window.dispatchEvent(new Event("aerotrack:pending-invites")),
              },
            ],
          },
          "info",
        );
      }

      if (e.eventType === "UPDATE") {
        // Someone accepted an invitation I issued. RLS only shows other
        // people's grants to org staff, so this can't fire for a bystander.
        //
        // "Was it already accepted?" has to come from the cache as well:
        // `old` is the primary key alone here too, so !e.old?.accepted is
        // vacuously true and every role change on an accepted grant would
        // re-announce the acceptance.
        const before = e.new?.id ? cache.current.get(e.new.id) : null;
        const wasAccepted = before ? !!before.accepted : !!e.old?.accepted;
        if (e.new?.accepted && !wasAccepted && !isMine(e.new)) {
          const role = e.new.role ? CRAFT_ROLE_LABELS[e.new.role] : "a collaborator";
          const name = who(e.new.user_name, e.new.invited_email);
          const craft = e.new.aircraft_id;
          toast(
            {
              title: name,
              who: name,
              reg: e.new.aircraft_reg ?? undefined,
              detail: `Accepted your invitation as ${role}`,
              actions: craft
                ? [{
                    label: "Manage access",
                    onClick: () => router.push(`/aircraft/${craft}?access=1`),
                  }]
                : undefined,
            },
            "ok",
          );
        }
      }

      if (e.eventType === "DELETE") {
        // Resolve through the cache; the payload itself is just an id.
        const id = e.old?.id;
        const gone = (id ? cache.current.get(id) : null) ?? e.old ?? null;
        const reg = gone?.aircraft_reg ?? "an aircraft";

        if (isMine(gone)) {
          // My own access ended. If I'm reading that very aircraft, do NOT
          // refresh — the server component can no longer see the row and would
          // render a 404. Explain it instead.
          if (gone?.aircraft_id && pathname === `/aircraft/${gone.aircraft_id}`) {
            lostAt.current = pathname;
            setLost(reg);
            if (id) cache.current.delete(id);
            return;
          }
          // Deliberately impersonal — no name, no initials. An aircraft can
          // have several owners and managers, and telling someone WHO removed
          // them turns an administrative act into a personal one. The person
          // who did it knows; the person who lost access only needs to know
          // that they did, and where to go next.
          toast(
            {
              title: "Access revoked",
              reg,
              detail: "You no longer have access to this aircraft.",
              actions: [
                { label: "Go to hangar", primary: true, onClick: () => router.push("/") },
              ],
            },
            "warn",
          );
        } else if (id && !wasSelfInitiated(id)) {
          // A grant I administer disappeared and I didn't remove it — they
          // declined or left. Revoking is the same DELETE on the wire, which
          // is what wasSelfInitiated() filters out.
          const name = who(gone?.user_name, gone?.invited_email);
          toast(
            { title: name, who: name, reg, detail: "Declined your invitation" },
            "warn",
          );
        }
        if (id) cache.current.delete(id);
      }

      // Keep the cache current for the NEXT delete, then re-render.
      void refreshCache();
      router.refresh();
    },
    [isMine, pathname, refreshCache, router, toast],
  );

  useAccessChanges(onAccess);

  // Clearing `lost` in the click handler tore the dialog — and its blur — down
  // while the hangar was still loading, flashing the aircraft they had just
  // lost access to. Wait for the navigation to commit instead.
  useEffect(() => {
    if (lost && lostAt.current && pathname !== lostAt.current) {
      lostAt.current = null;
      setLost(null);
    }
  }, [pathname, lost]);

  if (!lost) return null;

  const leave = () => startLeaving(() => router.push("/"));

  return (
    <Modal
      title="Access removed"
      onClose={leave}
      // The page behind is an aircraft this person may no longer see, and it
      // could be the Insurance tab. A translucent backdrop would leave the
      // numbers readable, so blur it out.
      obscure
      // No click-away or Escape — leaving the page is the only outcome, and a
      // stray click shouldn't drop them back onto content they've lost.
      dismissible={false}
    >
      <div style={{ fontSize: 13, color: "var(--muted3)", lineHeight: 1.7 }}>
        Your access to <b>{lost}</b> has been removed. You can no longer view
        its records.
      </div>
      <div className="form-actions">
        <button className="btn primary" onClick={leave} disabled={leaving}>
          {leaving ? "Returning…" : "Return to Hangar"}
        </button>
      </div>
    </Modal>
  );
}
