"use client";

import { useState } from "react";
import { oilLife, type OilEntry } from "@/lib/aircraft";
import type { TabProps } from "../detail-client";
import { Modal } from "@/components/ui/modal";

export function OilTab({ data, maintHrs, save }: TabProps) {
  const entries = (data.oil ?? []) as OilEntry[];
  const life = oilLife(data, maintHrs);
  const barColor =
    life.pct <= 0 ? "var(--danger)" : life.pct < 15 ? "var(--warn)" : "var(--ok)";

  const [mode, setMode] = useState<null | "add" | "change">(null);
  const [form, setForm] = useState<OilEntry>({
    date: new Date().toISOString().slice(0, 10),
    hobbs: Number(maintHrs.toFixed(1)),
  });
  const [busy, setBusy] = useState(false);

  async function submit() {
    setBusy(true);
    const entry: OilEntry = { ...form, kind: mode === "change" ? "change" : "add" };
    const nextData = { ...data, oil: [entry, ...entries] };
    // An oil change resets the oil-life clock to the current hours.
    if (mode === "change") {
      nextData.oilHobbs = Number(maintHrs.toFixed(1));
      nextData.oilChangeDate = form.date;
    }
    await save(nextData);
    setBusy(false);
    setMode(null);
    setForm({ date: new Date().toISOString().slice(0, 10), hobbs: Number(maintHrs.toFixed(1)) });
  }

  return (
    <>
      <div className="tbl-toolbar">
        <button className="btn sm" onClick={() => setMode("add")}>
          + Add Oil
        </button>
        <button className="btn primary sm" onClick={() => setMode("change")}>
          Oil Change
        </button>
      </div>

      <div className="stat-row">
        <div className="stat-box">
          <div className="stat-lbl">Oil Life</div>
          <div className="stat-val" style={{ color: barColor }}>
            {Math.round(life.pct)}%
          </div>
          <div className="stat-sub">
            {life.hrsLeft >= 0
              ? `${life.hrsLeft.toFixed(1)} hrs to next change`
              : `${life.overdueHrs.toFixed(1)} hrs overdue`}
          </div>
        </div>
        <div className="stat-box">
          <div className="stat-lbl">Interval</div>
          <div className="stat-val">{life.interval}</div>
          <div className="stat-sub">hours between changes</div>
        </div>
        <div className="stat-box">
          <div className="stat-lbl">Used Since Change</div>
          <div className="stat-val">{life.used.toFixed(1)}</div>
          <div className="stat-sub">hours</div>
        </div>
      </div>

      <div className="panel" style={{ marginTop: 14 }}>
        <div className="panel-title">Oil Log</div>
        <ul className="log-list">
          {entries.length === 0 ? (
            <li className="log-item" style={{ color: "var(--muted2)" }}>
              No oil entries.
            </li>
          ) : (
            entries.map((e, idx) => (
              <li className="log-item" key={idx}>
                <span className="log-date">{e.date}</span>
                <span className="log-qty">
                  {e.kind === "change" ? "CHG" : e.qty != null ? `${e.qty} qt` : ""}
                </span>
                <span className="log-note">
                  {e.type ?? ""}
                  {e.hobbs != null ? ` · ${e.hobbs} hrs` : ""}
                  {e.notes ? ` · ${e.notes}` : ""}
                </span>
              </li>
            ))
          )}
        </ul>
      </div>

      {mode && (
        <Modal
          title={mode === "change" ? "Log Oil Change" : "Add Oil"}
          onClose={() => setMode(null)}
        >
          <div className="form-grid">
            <div className="form-row">
              <label>Date</label>
              <input type="date" value={form.date} onChange={(e) => setForm((f) => ({ ...f, date: e.target.value }))} />
            </div>
            <div className="form-row">
              <label>Hours</label>
              <input type="number" step="0.1" value={form.hobbs ?? ""} onChange={(e) => setForm((f) => ({ ...f, hobbs: Number(e.target.value) }))} />
            </div>
          </div>
          {mode === "add" && (
            <div className="form-row">
              <label>Quantity (qt)</label>
              <input type="number" step="0.5" value={form.qty ?? ""} onChange={(e) => setForm((f) => ({ ...f, qty: Number(e.target.value) }))} />
            </div>
          )}
          <div className="form-row">
            <label>Oil Type</label>
            <input value={form.type ?? ""} onChange={(e) => setForm((f) => ({ ...f, type: e.target.value }))} placeholder="Aeroshell 15W-50" />
          </div>
          <div className="form-row">
            <label>Notes</label>
            <input value={form.notes ?? ""} onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))} />
          </div>
          {mode === "change" && (
            <div className="how-box" style={{ marginBottom: 0 }}>
              Recording an oil change resets the oil-life clock to{" "}
              <b>{maintHrs.toFixed(1)} hrs</b>.
            </div>
          )}
          <div className="form-actions">
            <button className="btn-cancel" onClick={() => setMode(null)}>Cancel</button>
            <button className="btn-save" onClick={submit} disabled={busy}>
              {busy ? "Saving…" : "Save"}
            </button>
          </div>
        </Modal>
      )}
    </>
  );
}
