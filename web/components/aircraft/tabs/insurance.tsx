"use client";

import { useState } from "react";
import type { TabProps } from "../detail-client";
import { Modal } from "@/components/ui/modal";

type Pilot = { name?: string; cert?: string; tt?: string | number; ratings?: string; medical?: string };

const FIELDS: [string, string][] = [
  ["carrier", "Carrier"],
  ["policy", "Policy #"],
  ["coverage", "Coverage"],
  ["premium", "Premium"],
  ["effective", "Effective"],
  ["expires", "Expires"],
];

export function InsuranceTab({ data, save }: TabProps) {
  const ins = (data.insurance ?? {}) as Record<string, unknown>;
  const pilots = (ins.pilots as Pilot[]) ?? [];

  const [editPolicy, setEditPolicy] = useState(false);
  const [addPilot, setAddPilot] = useState(false);
  const [busy, setBusy] = useState(false);
  const [pf, setPf] = useState<Record<string, string>>(
    Object.fromEntries(FIELDS.map(([k]) => [k, (ins[k] as string) ?? ""])),
  );
  const [pilot, setPilot] = useState<Pilot>({});

  async function savePolicy() {
    setBusy(true);
    await save({ ...data, insurance: { ...ins, ...pf } });
    setBusy(false);
    setEditPolicy(false);
  }
  async function savePilot() {
    setBusy(true);
    await save({ ...data, insurance: { ...ins, pilots: [...pilots, pilot] } });
    setBusy(false);
    setAddPilot(false);
    setPilot({});
  }

  return (
    <>
      <div className="two-col">
        <div className="panel">
          <div className="panel-title" style={{ display: "flex", justifyContent: "space-between" }}>
            <span>Policy</span>
            <button className="action-btn" onClick={() => setEditPolicy(true)}>Edit</button>
          </div>
          {FIELDS.map(([k, label]) => (
            <div className="ins-field" key={k}>
              <span className="ins-field-label">{label}</span>
              <span className="ins-field-value">
                {ins[k] != null && ins[k] !== "" ? String(ins[k]) : "—"}
              </span>
            </div>
          ))}
        </div>

        <div className="panel">
          <div className="panel-title" style={{ display: "flex", justifyContent: "space-between" }}>
            <span>Named Pilots</span>
            <button className="action-btn" onClick={() => setAddPilot(true)}>+ Add</button>
          </div>
          {pilots.length === 0 ? (
            <div style={{ color: "var(--muted2)", fontSize: 13 }}>No named pilots.</div>
          ) : (
            pilots.map((p, idx) => (
              <div className="pilot-card" key={idx}>
                <div>
                  <div className="pilot-card-name">{p.name ?? "—"}</div>
                  <div className="pilot-card-meta">
                    {p.cert ?? ""}
                    {p.ratings ? ` · ${p.ratings}` : ""}
                    {p.tt ? ` · ${p.tt} TT` : ""}
                    {p.medical ? ` · ${p.medical}` : ""}
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {editPolicy && (
        <Modal title="Edit Policy" onClose={() => setEditPolicy(false)}>
          {FIELDS.map(([k, label]) => (
            <div className="form-row" key={k}>
              <label>{label}</label>
              <input value={pf[k]} onChange={(e) => setPf((p) => ({ ...p, [k]: e.target.value }))} />
            </div>
          ))}
          <div className="form-actions">
            <button className="btn-cancel" onClick={() => setEditPolicy(false)}>Cancel</button>
            <button className="btn-save" onClick={savePolicy} disabled={busy}>
              {busy ? "Saving…" : "Save"}
            </button>
          </div>
        </Modal>
      )}

      {addPilot && (
        <Modal title="Add Named Pilot" onClose={() => setAddPilot(false)}>
          <div className="form-row">
            <label>Name</label>
            <input value={pilot.name ?? ""} onChange={(e) => setPilot((p) => ({ ...p, name: e.target.value }))} />
          </div>
          <div className="form-grid">
            <div className="form-row">
              <label>Certificate</label>
              <input value={pilot.cert ?? ""} onChange={(e) => setPilot((p) => ({ ...p, cert: e.target.value }))} placeholder="PPL / IR" />
            </div>
            <div className="form-row">
              <label>Total Time</label>
              <input value={String(pilot.tt ?? "")} onChange={(e) => setPilot((p) => ({ ...p, tt: e.target.value }))} />
            </div>
          </div>
          <div className="form-row">
            <label>Ratings</label>
            <input value={pilot.ratings ?? ""} onChange={(e) => setPilot((p) => ({ ...p, ratings: e.target.value }))} />
          </div>
          <div className="form-actions">
            <button className="btn-cancel" onClick={() => setAddPilot(false)}>Cancel</button>
            <button className="btn-save" onClick={savePilot} disabled={busy}>
              {busy ? "Saving…" : "Add Pilot"}
            </button>
          </div>
        </Modal>
      )}
    </>
  );
}
