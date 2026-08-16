"use client";

import { useState } from "react";
import { today, type FlightEntry, type RouteEntry } from "@/lib/aircraft";
import type { TabProps } from "../detail-client";
import { Modal } from "@/components/ui/modal";
import { Confirm } from "@/components/ui/confirm";
import { RowMenu } from "@/components/ui/row-menu";
import { useToast } from "@/components/ui/toast";

export function FlightsTab({ data, save, consumeAction, aircraft }: TabProps) {
  const flights = (data.flights ?? []) as FlightEntry[];
  const toast = useToast();
  // Opens straight into "Log Flight" when routed from the dashboard.
  const [modal, setModal] = useState<null | { idx?: number }>(
    () => (consumeAction("log-flight") ? {} : null),
  );
  const [form, setForm] = useState<FlightEntry>({ date: today() });
  const [busy, setBusy] = useState(false);
  const [confirmIdx, setConfirmIdx] = useState<number | null>(null);

  function openAdd() {
    setForm({ date: today() });
    setModal({});
  }
  function openEdit(idx: number) {
    setForm({ ...flights[idx] });
    setModal({ idx });
  }

  async function submit() {
    setBusy(true);
    const entry: FlightEntry = {
      ...form,
      from: form.from?.trim().toUpperCase() || undefined,
      to: form.to?.trim().toUpperCase() || undefined,
    };
    const nextFlights =
      modal?.idx != null ? flights.map((f, k) => (k === modal.idx ? entry : f)) : [entry, ...flights];

    // v1 pushed every logged flight onto flightRoutes so it appeared on the
    // map; the first port wrote only `flights`, so manual legs never plotted.
    const routes = (data.flightRoutes ?? []) as RouteEntry[];
    const key = (r: { from?: string; to?: string; date?: string }) =>
      `${r.from ?? ""}>${r.to ?? ""}|${r.date ?? ""}`;
    const nextRoutes =
      entry.from && entry.to && !routes.some((r) => key(r) === key(entry))
        ? [...routes, { from: entry.from, to: entry.to, date: entry.date, reg: aircraft.reg }]
        : routes;

    await save({ ...data, flights: nextFlights, flightRoutes: nextRoutes });
    setBusy(false);
    setModal(null);
    toast(modal?.idx != null ? "Flight updated" : "Flight logged", "ok");
  }

  async function remove(idx: number) {
    await save({ ...data, flights: flights.filter((_, k) => k !== idx) });
    setConfirmIdx(null);
    toast("Flight deleted", "ok");
  }

  const set = (k: keyof FlightEntry, v: string) =>
    setForm((f) => ({
      ...f,
      [k]: k === "date" || k === "from" || k === "to" || k === "notes"
        ? v
        : v === "" ? undefined : Number(v),
    }));

  const durOf = (f: FlightEntry) =>
    f.dur ?? (f.hobbsIn != null && f.hobbsOut != null ? f.hobbsIn - f.hobbsOut : null);

  const total = flights.reduce((s, f) => s + (durOf(f) ?? 0), 0);

  return (
    <>
      {/* Rendered as a section at the bottom of Utilization, exactly where v1
          kept the flight log — there is no separate Flights tab. */}
      <div style={{ marginTop: 20, borderTop: "1px solid var(--border2)", paddingTop: 16 }}>
        <div className="section-hd">
          <span className="section-label">Flight Log</span>
          <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
            <span className="mono">
              {flights.length} flight{flights.length === 1 ? "" : "s"} · {total.toFixed(1)} hrs
            </span>
            <button className="btn sm" onClick={openAdd}>Log Flight</button>
          </div>
        </div>

        {flights.length === 0 ? (
          <div style={{ color: "var(--muted2)", fontSize: 13, padding: "10px 0" }}>
            No flights logged yet. Use <b>Log Flight</b> to add entries.
          </div>
        ) : (
          flights.map((f, idx) => {
            const dur = durOf(f);
            return (
              <div className="flight-entry" key={idx}>
                <span className="fl-date">{f.date}</span>
                <span className="fl-route">{(f.from ?? "—") + " → " + (f.to ?? "—")}</span>
                <span className="fl-dur">{dur != null ? `${dur.toFixed(1)}h` : "—"}</span>
                <span className="fl-rem">{f.notes ?? ""}</span>
                <RowMenu
                  items={[
                    { label: "Edit", onClick: () => openEdit(idx) },
                    { label: "Delete", onClick: () => setConfirmIdx(idx), danger: true },
                  ]}
                />
              </div>
            );
          })
        )}
      </div>

      {modal && (
        <Modal title={modal.idx != null ? "Edit Flight" : "Log Flight"} onClose={() => setModal(null)}>
          <div className="form-grid">
            <div className="form-row">
              <label>Date</label>
              <input type="date" value={form.date} onChange={(e) => set("date", e.target.value)} />
            </div>
            <div className="form-row">
              <label>Duration (hrs)</label>
              <input
                type="number" step="0.1"
                value={form.dur ?? ""}
                onChange={(e) => set("dur", e.target.value)}
                placeholder="1.5"
              />
            </div>
          </div>
          <div className="form-grid">
            <div className="form-row">
              <label>From</label>
              <input value={form.from ?? ""} onChange={(e) => set("from", e.target.value)} placeholder="KPIE" />
            </div>
            <div className="form-row">
              <label>To</label>
              <input value={form.to ?? ""} onChange={(e) => set("to", e.target.value)} placeholder="KORL" />
            </div>
          </div>
          <div className="form-row">
            <label>Hobbs Out / In</label>
            <div className="form-grid">
              <input type="number" step="0.1" value={form.hobbsOut ?? ""} onChange={(e) => set("hobbsOut", e.target.value)} placeholder="1243.0" />
              <input type="number" step="0.1" value={form.hobbsIn ?? ""} onChange={(e) => set("hobbsIn", e.target.value)} placeholder="1244.5" />
            </div>
          </div>
          <div className="form-row">
            <label>Remarks</label>
            <input value={form.notes ?? ""} onChange={(e) => set("notes", e.target.value)} placeholder="Optional notes..." />
          </div>
          <div className="form-actions">
            <button className="btn-cancel" onClick={() => setModal(null)}>Cancel</button>
            <button className="btn-save" onClick={submit} disabled={busy}>
              {busy ? "Saving…" : "Save Flight"}
            </button>
          </div>
        </Modal>
      )}

      {confirmIdx != null && (
        <Confirm
          message={<>Delete the {flights[confirmIdx]?.date} flight?</>}
          onConfirm={() => remove(confirmIdx)}
          onCancel={() => setConfirmIdx(null)}
        />
      )}
    </>
  );
}
