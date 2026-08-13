"use client";

import { useCallback, useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { Modal } from "@/components/ui/modal";
import type { CraftRole } from "@/lib/types";

type Grant = { id: string; invited_email: string | null; user_id: string | null; role: CraftRole };
type Assign = { id: string; invited_email: string | null; ends_at: string; starts_at: string };

const ROLE_LABEL: Record<CraftRole, string> = {
  owner: "Owner",
  manager: "Manager",
  pilot: "Pilot",
};

// Manage who can see/log this aircraft. Standing grants (owner/manager/pilot)
// live in aircraft_access; date-windowed contract pilots live in assignments.
// Access resolves the moment the invitee signs in with the granted email —
// no accept step needed (RLS matches on the JWT email).
export function ManageAccess({
  aircraftId,
  orgId,
  reg,
}: {
  aircraftId: string;
  orgId: string;
  reg: string;
}) {
  const [open, setOpen] = useState(false);
  const [grants, setGrants] = useState<Grant[]>([]);
  const [assigns, setAssigns] = useState<Assign[]>([]);
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<CraftRole>("owner");
  const [contract, setContract] = useState(false);
  const [ends, setEnds] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const load = useCallback(async () => {
    const s = createClient();
    const [{ data: g }, { data: a }] = await Promise.all([
      s.from("aircraft_access").select("id, invited_email, user_id, role").eq("aircraft_id", aircraftId),
      s
        .from("assignments")
        .select("id, invited_email, ends_at, starts_at")
        .eq("aircraft_id", aircraftId)
        .is("revoked_at", null)
        .gte("ends_at", new Date().toISOString()),
    ]);
    setGrants((g as Grant[]) ?? []);
    setAssigns((a as Assign[]) ?? []);
  }, [aircraftId]);

  useEffect(() => {
    if (open) load();
  }, [open, load]);

  async function grant() {
    const e = email.trim().toLowerCase();
    if (!e) {
      setErr("Enter an email address.");
      return;
    }
    setBusy(true);
    setErr(null);
    const s = createClient();
    const { error } = contract
      ? await s.from("assignments").insert({
          org_id: orgId,
          aircraft_id: aircraftId,
          invited_email: e,
          ends_at: ends
            ? new Date(ends + "T23:59:59").toISOString()
            : new Date(Date.now() + 7 * 86_400_000).toISOString(),
          purpose: "Contract pilot",
        })
      : await s.from("aircraft_access").insert({
          org_id: orgId,
          aircraft_id: aircraftId,
          invited_email: e,
          role,
        });
    if (error) {
      setErr(
        error.code === "23505"
          ? "That person already has access."
          : error.message,
      );
      setBusy(false);
      return;
    }
    setEmail("");
    setEnds("");
    setContract(false);
    await load();
    setBusy(false);
  }

  async function revokeGrant(id: string) {
    await createClient().from("aircraft_access").delete().eq("id", id);
    load();
  }
  async function revokeAssign(id: string) {
    await createClient().from("assignments").update({ revoked_at: new Date().toISOString() }).eq("id", id);
    load();
  }

  const empty = grants.length === 0 && assigns.length === 0;

  return (
    <>
      <button className="btn sm" onClick={() => setOpen(true)}>
        Manage Access
      </button>

      {open && (
        <Modal title={`Access · ${reg}`} onClose={() => setOpen(false)}>
          {/* Current access */}
          <div className="form-divider" style={{ borderTop: "none", marginTop: 0 }}>
            People with access
          </div>
          {empty ? (
            <div style={{ color: "var(--muted2)", fontSize: 13, padding: "4px 0 10px" }}>
              Only org managers can see this aircraft. Grant access below.
            </div>
          ) : (
            <ul className="doc-list" style={{ marginBottom: 8 }}>
              {grants.map((g) => (
                <li className="doc-item" key={g.id}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div className="doc-name">{g.invited_email ?? "(linked user)"}</div>
                    <div className="doc-meta">{ROLE_LABEL[g.role]}</div>
                  </div>
                  <button className="action-btn del" onClick={() => revokeGrant(g.id)}>
                    Revoke
                  </button>
                </li>
              ))}
              {assigns.map((a) => (
                <li className="doc-item" key={a.id}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div className="doc-name">{a.invited_email ?? "(linked user)"}</div>
                    <div className="doc-meta">
                      Contract pilot · until {a.ends_at.slice(0, 10)}
                    </div>
                  </div>
                  <button className="action-btn del" onClick={() => revokeAssign(a.id)}>
                    End
                  </button>
                </li>
              ))}
            </ul>
          )}

          {/* Grant form */}
          <div className="form-divider">Grant access</div>
          <div className="form-row">
            <label>Email</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="person@example.com"
            />
          </div>
          {!contract ? (
            <div className="form-row">
              <label>Role</label>
              <select value={role} onChange={(e) => setRole(e.target.value as CraftRole)}>
                <option value="owner">Owner — sees their aircraft, logs flights, no financials edit</option>
                <option value="manager">Manager — full management</option>
                <option value="pilot">Pilot — airworthiness + logs flights, no money</option>
              </select>
            </div>
          ) : (
            <div className="form-row">
              <label>Access ends</label>
              <input type="date" value={ends} onChange={(e) => setEnds(e.target.value)} />
            </div>
          )}
          <label
            style={{
              display: "flex",
              alignItems: "center",
              gap: 8,
              fontSize: 12,
              color: "var(--muted2)",
              cursor: "pointer",
              margin: "2px 0 4px",
            }}
          >
            <input
              type="checkbox"
              checked={contract}
              onChange={(e) => setContract(e.target.checked)}
              style={{ width: "auto" }}
            />
            One-off contract pilot (access expires automatically)
          </label>
          {err && <div className="auth-err">{err}</div>}
          <div className="form-actions">
            <button className="btn-cancel" onClick={() => setOpen(false)}>Close</button>
            <button className="btn-save" onClick={grant} disabled={busy}>
              {busy ? "Granting…" : "Grant Access"}
            </button>
          </div>
        </Modal>
      )}
    </>
  );
}
