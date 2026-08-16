"use client";

import { useCallback, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useAccessChanges, type AccessEvent, type AccessRow } from "@/lib/realtime";
import { wasSelfInitiated } from "@/lib/access-events";
import { useToast } from "@/components/ui/toast";
import { Modal } from "@/components/ui/modal";
import { CRAFT_ROLE_LABELS } from "@/lib/permissions";

/**
 * Watches access grants for the whole signed-in session, mounted once in the
 * root layout so it covers every authenticated page.
 *
 * Ported from v1's handleRealtimeSharesUpdate(). v1 narrated all of this —
 * who accepted, who declined, whose access was pulled — and the port had gone
 * silent, refreshing the page with no explanation. Worse, a revocation while
 * the person was reading that aircraft refreshed a server component that could
 * no longer see the row, so they got a raw 404.
 */
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

  const isMine = useCallback(
    (row: Partial<AccessRow> | null) =>
      !!row &&
      ((!!userId && row.user_id === userId) ||
        (!!email &&
          !!row.invited_email &&
          row.invited_email.toLowerCase() === email.toLowerCase())),
    [userId, email],
  );

  const onAccess = useCallback(
    (e: AccessEvent) => {
      const row = e.new ?? e.old;
      const reg = row?.aircraft_reg ?? "an aircraft";

      if (e.eventType === "INSERT" && isMine(e.new)) {
        // PendingInvites raises the banner itself; this is the nudge for
        // someone who isn't looking at the hangar.
        toast(`You've been invited to ${reg}`, "info");
      }

      if (e.eventType === "UPDATE") {
        // Someone accepted an invitation I issued. Only fires for a granter,
        // since RLS only shows other people's grants to org staff.
        if (e.new?.accepted && !e.old?.accepted && !isMine(e.new)) {
          const role = e.new.role ? CRAFT_ROLE_LABELS[e.new.role] : "a collaborator";
          toast(
            `${e.new.invited_email ?? "Someone"} accepted your invitation for ${reg} as ${role}`,
            "ok",
          );
        }
      }

      if (e.eventType === "DELETE") {
        const gone = e.old;
        if (isMine(gone)) {
          // My own access ended. If I'm looking at that very aircraft, do NOT
          // refresh — the server component can't read it any more and would
          // 404. Explain it instead.
          if (gone?.aircraft_id && pathname === `/aircraft/${gone.aircraft_id}`) {
            setLost(reg);
            return;
          }
          toast(`Your access to ${reg} has been revoked by the owner`, "warn");
        } else if (gone?.id && !wasSelfInitiated(gone.id)) {
          // A grant I could see disappeared and I didn't remove it — they
          // declined or left. Revoking is the same DELETE on the wire, which
          // is what wasSelfInitiated() filters out.
          toast(
            `${gone.invited_email ?? "Someone"} declined your invitation for ${reg}`,
            "warn",
          );
        }
      }

      router.refresh();
    },
    [isMine, pathname, router, toast],
  );

  useAccessChanges(onAccess);

  if (!lost) return null;

  return (
    <Modal title="Access removed" onClose={() => router.push("/")}>
      <div style={{ fontSize: 13, color: "var(--muted3)", lineHeight: 1.7 }}>
        Your access to <b>{lost}</b> has been revoked by the owner. You can no
        longer view its records.
      </div>
      <div className="form-actions">
        <button className="btn primary" onClick={() => router.push("/")}>
          Return to Hangar
        </button>
      </div>
    </Modal>
  );
}
