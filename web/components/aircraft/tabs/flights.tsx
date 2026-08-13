"use client";

import { useState } from "react";
import type { FlightEntry } from "@/lib/aircraft";
import type { TabProps } from "../detail-client";
import { Modal } from "@/components/ui/modal";

export function FlightsTab({ data, save }: TabProps) {
  const flights = (data.flights ?? []) as FlightEntry[];
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<FlightEntry>({
    date: new Date().toISOString().slice(0, 10),
  });
  const [busy, setBusy] = useState(false);

  async function submit() {
    setBusy(true);
    const next = [{ ...form }, ...flights];
    await save({ ...data, flights: next });
    setBusy(false);
    setOpen(false);
    setForm({ date: new Date().toISOString().slice(0, 10) });
  }

  const set = (k: keyof FlightEntry, v: string) =>
    setForm((f) => ({
      ...f,
      [k]: k === "date" || k === "from" || k === "to" || k === "notes" ? v : Number(v),
    }));

  return (
    <>
      <div className="tbl-toolbar">
        <button className="btn primary sm" onClick={() => setOpen(true)}>
          + Log Flight
        </button>
      </div>

      <div className="panel">
        <div className="panel-title">Flight Log</div>
        {flights.length === 0 ? (
          <div style={{ color: "var(--muted2)", fontSize: 13 }}>
            No flights logged.
          </div>
        ) : (
          flights.map((f, idx) => {
            const dur =
              f.dur ??
              (f.hobbsIn != null && f.hobbsOut != null
                ? f.hobbsIn - f.hobbsOut
                : null);
            return (
              <div className="flight-entry" key={idx}>
                <span className="fl-date">{f.date}</span>
                <span className="fl-route">
                  {(f.from ?? "—") + " → " + (f.to ?? "—")}
                </span>
                <span className="fl-dur">
                  {dur != null ? `${dur.toFixed(1)}h` : "—"}
                </span>
                <span className="fl-rem">{f.notes ?? ""}</span>
              </div>
            );
          })
        )}
      </div>

      {open && (
        <Modal title="Log Flight" onClose={() => setOpen(false)}>
          <div className="form-row">
            <label>Date</label>
            <input type="date" value={form.date} onChange={(e) => set("date", e.target.value)} />
          </div>
          <div className="form-grid">
            <div className="form-row">
              <label>From</label>
              <input value={form.from ?? ""} onChange={(e) => set("from", e.target.value)} placeholder="KPIE" />
            </div>
            <div className="form-row">
              <label>To</label>
              <input value={form.to ?? ""} onChange={(e) => set("to", e.target.value)} placeholder="KSRQ" />
            </div>
          </div>
          <div className="form-grid">
            <div className="form-row">
              <label>Hobbs Out</label>
              <input type="number" step="0.1" value={form.hobbsOut ?? ""} onChange={(e) => set("hobbsOut", e.target.value)} />
            </div>
            <div className="form-row">
              <label>Hobbs In</label>
              <input type="number" step="0.1" value={form.hobbsIn ?? ""} onChange={(e) => set("hobbsIn", e.target.value)} />
            </div>
          </div>
          <div className="form-row">
            <label>Notes</label>
            <input value={form.notes ?? ""} onChange={(e) => set("notes", e.target.value)} />
          </div>
          <div className="form-actions">
            <button className="btn-cancel" onClick={() => setOpen(false)}>Cancel</button>
            <button className="btn-save" onClick={submit} disabled={busy}>
              {busy ? "Saving…" : "Log Flight"}
            </button>
          </div>
        </Modal>
      )}
    </>
  );
}
