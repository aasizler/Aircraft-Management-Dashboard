"use client";

import { useState } from "react";
import type { SchedEvent } from "@/lib/aircraft";
import type { TabProps } from "../detail-client";
import { Modal } from "@/components/ui/modal";

const TYPE_COLOR: Record<string, string> = {
  flight: "var(--accent)",
  maintenance: "var(--warn)",
  inspection: "var(--danger)",
  reservation: "var(--ok)",
};
const TYPES = ["flight", "maintenance", "inspection", "reservation"];

export function ScheduleTab({ data, save }: TabProps) {
  const events = ((data.schedule ?? []) as SchedEvent[])
    .slice()
    .sort((a, b) => (a.start ?? "").localeCompare(b.start ?? ""));
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [f, setF] = useState<SchedEvent>({
    type: "flight",
    title: "",
    start: new Date().toISOString().slice(0, 10),
  });

  const set = (k: keyof SchedEvent, v: string) => setF((p) => ({ ...p, [k]: v }));

  async function submit() {
    setBusy(true);
    const evt: SchedEvent = { ...f, id: "ev_" + Date.now(), status: "confirmed" };
    await save({ ...data, schedule: [...(data.schedule ?? []), evt] as SchedEvent[] });
    setBusy(false);
    setOpen(false);
    setF({ type: "flight", title: "", start: new Date().toISOString().slice(0, 10) });
  }

  return (
    <>
      <div className="tbl-toolbar">
        <button className="btn primary sm" onClick={() => setOpen(true)}>
          + Add Event
        </button>
      </div>

      <div className="panel">
        <div className="panel-title">Upcoming</div>
        {events.length === 0 ? (
          <div className="sched-empty">Nothing scheduled.</div>
        ) : (
          events.map((e, idx) => (
            <div className="sched-event" key={e.id ?? idx}>
              <span
                className="sched-type-dot"
                style={{ background: TYPE_COLOR[e.type ?? ""] ?? "var(--muted)" }}
              />
              <div>
                <div className="sched-title">{e.title ?? e.type ?? "Event"}</div>
                <div className="sched-meta">
                  {e.start ?? ""}
                  {e.end ? ` → ${e.end}` : ""}
                  {e.pilot ? ` · ${e.pilot}` : ""}
                </div>
              </div>
            </div>
          ))
        )}
      </div>

      {open && (
        <Modal title="Add Event" onClose={() => setOpen(false)}>
          <div className="form-row">
            <label>Title</label>
            <input value={f.title ?? ""} onChange={(e) => set("title", e.target.value)} placeholder="Oil change" />
          </div>
          <div className="form-grid">
            <div className="form-row">
              <label>Type</label>
              <select value={f.type} onChange={(e) => set("type", e.target.value)}>
                {TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>
            <div className="form-row">
              <label>Pilot / Vendor</label>
              <input value={f.pilot ?? ""} onChange={(e) => set("pilot", e.target.value)} />
            </div>
          </div>
          <div className="form-grid">
            <div className="form-row">
              <label>Start</label>
              <input type="date" value={f.start ?? ""} onChange={(e) => set("start", e.target.value)} />
            </div>
            <div className="form-row">
              <label>End</label>
              <input type="date" value={f.end ?? ""} onChange={(e) => set("end", e.target.value)} />
            </div>
          </div>
          <div className="form-actions">
            <button className="btn-cancel" onClick={() => setOpen(false)}>Cancel</button>
            <button className="btn-save" onClick={submit} disabled={busy}>
              {busy ? "Saving…" : "Add Event"}
            </button>
          </div>
        </Modal>
      )}
    </>
  );
}
