"use client";

import { useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { daysUntil, newId, readInsurance, today, type DocEntry, type Pilot } from "@/lib/aircraft";
import type { TabProps } from "../detail-client";
import { Modal } from "@/components/ui/modal";
import { Confirm } from "@/components/ui/confirm";
import { useToast } from "@/components/ui/toast";

// v1 field names. The first port read carrier/expires/coverage/premium, which
// meant an imported policy (provider/expiration/hull/liability/deductible)
// never displayed and editing forked the record into a second key set.
const FIELDS: [keyof ReturnType<typeof readInsurance>, string][] = [
  ["provider", "Provider"],
  ["policy", "Policy Number"],
  ["effective", "Effective"],
  ["expiration", "Expiration"],
  ["deductFlight", "In-Flight Deductible"],
  ["deductGround", "Ground Deductible"],
  ["pilotReq", "Pilot Requirements"],
];

// Fields the summary cards already show, so v1 kept them out of the details
// list. They still appear in the edit form.
const EDIT_ONLY: [keyof ReturnType<typeof readInsurance>, string][] = [
  ["hull", "Hull Value"],
  ["liability", "Liability"],
];

// Edit-form labels and placeholders, verbatim from v1's Policy Details modal.
const EDIT_META: Record<string, { label: string; ph?: string }> = {
  provider: { label: "Insurance Provider", ph: "AVEMCO, Global Aerospace, etc." },
  policy: { label: "Policy Number", ph: "POL-00000" },
  effective: { label: "Effective Date" },
  expiration: { label: "Expiration Date" },
  hull: { label: "Hull Value ($)", ph: "200000" },
  liability: { label: "Liability Limits", ph: "$1M smooth / $100K per person" },
  deductFlight: { label: "In-Flight Deductible", ph: "$0" },
  deductGround: { label: "Ground Deductible", ph: "$500" },
  pilotReq: { label: "Open Pilot Warranty / Pilot Requirements", ph: "Minimum 250TT, 50 in type, instrument rated..." },
};

export function InsuranceTab({ aircraft, data, save }: TabProps) {
  const ins = readInsurance(data.insurance);
  const pilots = ins.pilots ?? [];
  const docs = ins.documents ?? [];
  const toast = useToast();

  const [editPolicy, setEditPolicy] = useState(false);
  const [pilotModal, setPilotModal] = useState<null | { idx?: number }>(null);
  const [busy, setBusy] = useState(false);
  const [confirmPilot, setConfirmPilot] = useState<number | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const [pf, setPf] = useState<Record<string, string>>(() =>
    Object.fromEntries([...FIELDS, ...EDIT_ONLY].map(([k]) => [k as string, String(ins[k] ?? "")])),
  );
  const [notes, setNotes] = useState(ins.coverageNotes ?? "");
  const [pilot, setPilot] = useState<Pilot>({});

  // Expiry badge, wording and thresholds ported from renderInsurance().
  const daysLeft = ins.expiration ? daysUntil(ins.expiration) : null;
  const expiryBadge =
    daysLeft == null
      ? null
      : daysLeft < 0
        ? { cls: "overdue", text: `EXPIRED ${Math.abs(daysLeft)} days ago` }
        : daysLeft <= 30
          ? { cls: "warn", text: `Expires in ${daysLeft} days` }
          : { cls: "ok", text: `Policy Active — ${daysLeft} days remaining` };

  async function savePolicy() {
    setBusy(true);
    await save({
      ...data,
      insurance: {
        ...(data.insurance ?? {}),
        ...pf,
        hull: pf.hull === "" ? 0 : Number(pf.hull) || pf.hull,
        // v1 stored coverage notes under `notes`; write the same key so the
        // two apps round-trip the same blob.
        notes,
        pilots,
        documents: docs,
      },
    });
    setBusy(false);
    setEditPolicy(false);
    toast("Policy saved", "ok");
  }

  async function savePilot() {
    if (!pilot.name?.trim()) { toast("Pilot name is required.", "warn"); return; }
    setBusy(true);
    const next =
      pilotModal?.idx != null
        ? pilots.map((p, k) => (k === pilotModal.idx ? pilot : p))
        : [...pilots, pilot];
    await save({ ...data, insurance: { ...(data.insurance ?? {}), pilots: next } });
    setBusy(false);
    setPilotModal(null);
    setPilot({});
    toast("Named pilot saved", "ok");
  }

  async function removePilot(idx: number) {
    await save({
      ...data,
      insurance: { ...(data.insurance ?? {}), pilots: pilots.filter((_, k) => k !== idx) },
    });
    setConfirmPilot(null);
    toast("Pilot removed", "ok");
  }

  async function uploadDoc(file: File) {
    setBusy(true);
    const path = `${aircraft.id}/insurance/${newId("doc")}_${file.name}`;
    const { error } = await createClient().storage.from("documents").upload(path, file);
    if (error) {
      toast(`Upload failed: ${error.message}`, "danger");
      setBusy(false);
      return;
    }
    const entry: DocEntry = {
      name: file.name,
      size: file.size,
      uploadedOn: today(),
      storagePath: path,
    };
    await save({
      ...data,
      insurance: { ...(data.insurance ?? {}), documents: [entry, ...docs] },
    });
    setBusy(false);
    toast("Policy document uploaded", "ok");
  }

  async function viewDoc(d: DocEntry) {
    const { data: signed } = await createClient()
      .storage.from("documents")
      .createSignedUrl(d.storagePath, 3600);
    if (signed?.signedUrl) window.open(signed.signedUrl, "_blank");
  }

  const val = (k: keyof typeof ins) => {
    const v = ins[k];
    if (v == null || v === "" || v === 0) return "—";
    if (k === "hull") return `$${Number(v).toLocaleString()}`;
    return String(v);
  };

  return (
    <>
      <div className="tbl-toolbar" style={{ justifyContent: "space-between" }}>
        <div>
          {expiryBadge && <span className={`badge ${expiryBadge.cls}`}>{expiryBadge.text}</span>}
        </div>
        <button className="btn sm primary" onClick={() => setEditPolicy(true)}>Edit Policy</button>
      </div>

      {/* Policy summary cards */}
      <div className="stat-row" style={{ marginBottom: 18 }}>
        <div className="stat-box">
          <div className="stat-lbl">Hull Value</div>
          <div className="stat-val" style={{ fontSize: 18 }}>{val("hull")}</div>
          <div className="stat-sub">insured value</div>
        </div>
        <div className="stat-box">
          <div className="stat-lbl">Liability</div>
          <div className="stat-val" style={{ fontSize: 14, lineHeight: 1.3 }}>{val("liability")}</div>
          <div className="stat-sub">coverage limits</div>
        </div>
        <div className="stat-box">
          <div className="stat-lbl">Named Pilots</div>
          <div className="stat-val">{pilots.length}</div>
          <div className="stat-sub">on policy</div>
        </div>
        <div className="stat-box">
          <div className="stat-lbl">Renewal</div>
          <div className="stat-val" style={{ fontSize: 14 }}>{val("expiration")}</div>
          <div className="stat-sub">expiration date</div>
        </div>
      </div>

      <div className="two-col" style={{ marginTop: 0 }}>
        <div className="panel">
          <div className="panel-title">Policy Details</div>
          {!ins.provider && !ins.policy ? (
            <div style={{ color: "var(--muted2)", padding: "16px 0", textAlign: "center", fontSize: 13 }}>
              No policy on file. Click Edit Policy to add details.
            </div>
          ) : (
            FIELDS.map(([k, label]) => (
              <div className="ins-field" key={k as string}>
                <span className="ins-field-label">{label}</span>
                <span className="ins-field-value">{val(k)}</span>
              </div>
            ))
          )}
        </div>

        <div className="panel">
          <div className="panel-title" style={{ display: "flex", justifyContent: "space-between" }}>
            <span>Named / Approved Pilots</span>
            <button className="action-btn" onClick={() => { setPilot({}); setPilotModal({}); }}>
              Add Pilot
            </button>
          </div>
          {pilots.length === 0 ? (
            <div style={{ color: "var(--muted2)", fontSize: 13 }}>No named pilots on file.</div>
          ) : (
            pilots.map((p, idx) => (
              <div className="pilot-card" key={idx}>
                <div>
                  <div className="pilot-card-name">{p.name ?? "—"}</div>
                  <div className="pilot-card-meta">
                    {[p.cert && `Cert: ${p.cert}`, p.tt && `${p.tt}TT`, p.intype && `${p.intype} in type`, p.ratings]
                      .filter(Boolean)
                      .join(" · ")}
                  </div>
                  {p.medical && <div className="pilot-card-meta">Medical: {p.medical}</div>}
                </div>
                <span className="action-cell">
                  <button className="action-btn" onClick={() => { setPilot(p); setPilotModal({ idx }); }}>
                    Edit
                  </button>
                  <button className="action-btn del" onClick={() => setConfirmPilot(idx)}>
                    Delete
                  </button>
                </span>
              </div>
            ))
          )}
        </div>
      </div>

      <div className="panel" style={{ marginTop: 14 }}>
        <div className="panel-title">Coverage Notes</div>
        <div style={{ fontSize: 13, color: "var(--muted2)", lineHeight: 1.7, whiteSpace: "pre-wrap" }}>
          {ins.coverageNotes || "No coverage notes on file."}
        </div>
      </div>

      <div className="panel" style={{ marginTop: 14 }}>
        <div className="panel-title" style={{ display: "flex", justifyContent: "space-between" }}>
          <span>Policy Documents</span>
          <button className="action-btn" onClick={() => fileRef.current?.click()} disabled={busy}>
            Upload PDF
          </button>
        </div>
        <input
          ref={fileRef}
          type="file"
          accept=".pdf,image/*"
          style={{ display: "none" }}
          onChange={(e) => e.target.files?.[0] && uploadDoc(e.target.files[0])}
        />
        {docs.length === 0 ? (
          <div style={{ fontSize: 12, color: "var(--muted2)", padding: "8px 0" }}>
            No documents uploaded.
          </div>
        ) : (
          <ul className="doc-list">
            {docs.map((d, i) => (
              <li className="doc-item" key={i}>
                <span className="doc-pdf-icon">{d.name.split(".").pop()?.slice(0, 3).toUpperCase() ?? "DOC"}</span>
                <div style={{ flex: 1, minWidth: 0, cursor: "pointer" }} onClick={() => viewDoc(d)}>
                  <div className="doc-name">{d.name}</div>
                  <div className="doc-meta">{d.uploadedOn ?? ""}</div>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>

      {editPolicy && (
        <Modal title="Policy Details" onClose={() => setEditPolicy(false)}>
          {[...FIELDS, ...EDIT_ONLY].map(([k]) => {
            const meta = EDIT_META[k as string] ?? { label: String(k) };
            return (
              <div className="form-row" key={k as string}>
                <label>{meta.label}</label>
                <input
                  type={k === "effective" || k === "expiration" ? "date" : "text"}
                  placeholder={meta.ph}
                  value={pf[k as string] ?? ""}
                  onChange={(e) => setPf((p) => ({ ...p, [k as string]: e.target.value }))}
                />
              </div>
            );
          })}
          <div className="form-row">
            <label>Coverage Notes</label>
            <textarea rows={3} value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Territorial limits, use limitations, endorsements..." />
          </div>
          <div className="form-actions">
            <button className="btn-cancel" onClick={() => setEditPolicy(false)}>Cancel</button>
            <button className="btn-save" onClick={savePolicy} disabled={busy}>
              {busy ? "Saving…" : "Save Policy"}
            </button>
          </div>
        </Modal>
      )}

      {pilotModal && (
        <Modal
          title={pilotModal.idx != null ? "Edit Named Pilot" : "Add Named Pilot"}
          onClose={() => setPilotModal(null)}
        >
          <div className="form-row">
            <label>Full Name</label>
            <input value={pilot.name ?? ""} onChange={(e) => setPilot((p) => ({ ...p, name: e.target.value }))} placeholder="John Smith" />
          </div>
          <div className="form-grid">
            <div className="form-row">
              <label>Certificate #</label>
              <input value={pilot.cert ?? ""} onChange={(e) => setPilot((p) => ({ ...p, cert: e.target.value }))} placeholder="FAA Cert #" />
            </div>
            <div className="form-row">
              <label>Total Time (hrs)</label>
              <input value={String(pilot.tt ?? "")} onChange={(e) => setPilot((p) => ({ ...p, tt: e.target.value }))} placeholder="500" />
            </div>
          </div>
          <div className="form-grid">
            <div className="form-row">
              <label>Time in Type (hrs)</label>
              <input value={String(pilot.intype ?? "")} onChange={(e) => setPilot((p) => ({ ...p, intype: e.target.value }))} placeholder="50" />
            </div>
            <div className="form-row">
              <label>Medical Expiry</label>
              <input type="date" value={pilot.medical ?? ""} onChange={(e) => setPilot((p) => ({ ...p, medical: e.target.value }))} />
            </div>
          </div>
          <div className="form-row">
            <label>Ratings</label>
            <input value={pilot.ratings ?? ""} onChange={(e) => setPilot((p) => ({ ...p, ratings: e.target.value }))} placeholder="PPL, Instrument, Complex..." />
          </div>
          <div className="form-actions">
            <button className="btn-cancel" onClick={() => setPilotModal(null)}>Cancel</button>
            <button className="btn-save" onClick={savePilot} disabled={busy}>
              {busy ? "Saving…" : "Save Pilot"}
            </button>
          </div>
        </Modal>
      )}

      {confirmPilot != null && (
        <Confirm
          message={<>Remove <b>{pilots[confirmPilot]?.name}</b> from the policy?</>}
          confirmLabel="Remove"
          onConfirm={() => removePilot(confirmPilot)}
          onCancel={() => setConfirmPilot(null)}
        />
      )}
    </>
  );
}
