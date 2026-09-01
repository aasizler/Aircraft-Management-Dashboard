"use client";

import { useState } from "react";
import { newId, today, type SchedEvent } from "@/lib/aircraft";
import type { TabProps } from "../detail-client";
import { Modal } from "@/components/ui/modal";
import { Confirm } from "@/components/ui/confirm";
import { RowMenu } from "@/components/ui/row-menu";
import { EmptyState } from "@/components/ui/empty-state";
import { useToast } from "@/components/ui/toast";

const TYPE_COLOR: Record<string, string> = {
  reservation: "var(--ok)",
  flight: "var(--accent)",
  maintenance: "var(--warn)",
  training: "#a855f7",
  other: "var(--muted2)",
};

// Event types and their labels, matching v1's Event Type dropdown.
const TYPES: [string, string][] = [
  ["reservation", "Aircraft Reservation"],
  ["flight", "Flight / Trip"],
  ["maintenance", "Maintenance Downtime"],
  ["training", "Flight Training"],
  ["other", "Other"],
];

/** Covers a date range, so multi-day events show on every day they span. */
function spans(e: SchedEvent, iso: string) {
  const s = e.start ?? "";
  const t = e.end || e.start || "";
  return !!s && iso >= s && iso <= t;
}

export function ScheduleTab({ aircraft, data, save }: TabProps) {
  const all = ((data.schedule ?? []) as SchedEvent[])
    .slice()
    .sort((a, b) => (a.start ?? "").localeCompare(b.start ?? ""));

  const toast = useToast();
  const [modal, setModal] = useState<null | { idx?: number }>(null);
  const [busy, setBusy] = useState(false);
  const [confirmIdx, setConfirmIdx] = useState<number | null>(null);
  const [day, setDay] = useState<string | null>(null);
  const [f, setF] = useState<SchedEvent>({ type: "reservation", title: "", start: today() });

  const set = (k: keyof SchedEvent, v: string) => setF((p) => ({ ...p, [k]: v }));

  // 14-day strip, ported from renderSchedule()/filterSchedule().
  const strip = Array.from({ length: 14 }, (_, i) => {
    const d = new Date();
    d.setDate(d.getDate() + i);
    const iso = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
    return {
      iso,
      dow: d.toLocaleDateString("en-US", { weekday: "short" }).toUpperCase(),
      num: d.getDate(),
      events: all.filter((e) => spans(e, iso)),
    };
  });

  const shown = day ? all.filter((e) => spans(e, day)) : all.filter((e) => (e.end || e.start || "") >= today());

  function openAdd() {
    setF({ type: "reservation", title: "", start: day ?? today() });
    setModal({});
  }
  function openEdit(idx: number) {
    setF({ ...all[idx] });
    setModal({ idx });
  }

  async function submit() {
    setBusy(true);
    const evt: SchedEvent = {
      ...f,
      id: f.id ?? newId("ev"),
      status: f.status ?? "confirmed",
    };
    const next =
      modal?.idx != null ? all.map((e, k) => (k === modal.idx ? evt : e)) : [...all, evt];
    await save({ ...data, schedule: next });
    setBusy(false);
    setModal(null);
    toast(modal?.idx != null ? "Event updated" : "Event added", "ok");
  }

  async function remove(idx: number) {
    await save({ ...data, schedule: all.filter((_, k) => k !== idx) });
    setConfirmIdx(null);
    toast("Event deleted", "ok");
  }

  return (
    <>
      <div className="tbl-toolbar" style={{ justifyContent: "space-between" }}>
        <span style={{ fontSize: 12, color: "var(--muted2)" }}>
          Upcoming events for{" "}
          <span className="mono" style={{ color: "var(--accent)" }}>{aircraft.reg}</span>
        </span>
        <button className="btn sm primary" onClick={openAdd}>Add Event</button>
      </div>

      <div className="cal-strip">
        {strip.map((d) => (
          <div
            key={d.iso}
            className={`cal-day${day === d.iso ? " on" : ""}`}
            onClick={() => setDay(day === d.iso ? null : d.iso)}
          >
            <div className="cal-dow">{d.dow}</div>
            <div className="cal-num">{d.num}</div>
            <div className="cal-pips">
              {d.events.slice(0, 3).map((e, i) => (
                <span
                  className="cal-pip"
                  key={i}
                  style={{ background: TYPE_COLOR[e.type ?? ""] ?? "var(--muted)" }}
                />
              ))}
            </div>
          </div>
        ))}
      </div>

      <div className="panel">
        <div className="panel-title">
          {day ? `Events on ${day}` : "Upcoming"}
          {day && (
            <button
              className="action-btn"
              style={{ marginLeft: 10, padding: "2px 8px", fontSize: 10 }}
              onClick={() => setDay(null)}
            >
              clear filter
            </button>
          )}
        </div>
        {shown.length === 0 ? (
          <EmptyState
            icon="calendar"
            title="Nothing on the schedule"
            body="Reservations, maintenance downtime and trips appear here, on the two-week strip above."
            action={{ label: "Add event", onClick: openAdd }}
          />
        ) : (
          shown.map((e) => {
            const idx = all.indexOf(e);
            return (
              <div className="sched-event" key={e.id ?? idx}>
                <span
                  className="sched-type-dot"
                  style={{ background: TYPE_COLOR[e.type ?? ""] ?? "var(--muted)" }}
                />
                <div style={{ flex: 1 }}>
                  <div className="sched-title">{e.title || e.type || "Event"}</div>
                  <div className="sched-meta">
                    {e.start ?? ""}
                    {e.end ? ` → ${e.end}` : ""}
                    {e.pilot ? ` · ${e.pilot}` : ""}
                    {e.notes ? ` · ${e.notes}` : ""}
                  </div>
                </div>
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
        <Modal title={modal.idx != null ? "Edit Event" : "Add Event"} onClose={() => setModal(null)}>
          <div className="form-row">
            <label>Event Type</label>
            <select value={f.type} onChange={(e) => set("type", e.target.value)}>
              {TYPES.map(([v, label]) => <option key={v} value={v}>{label}</option>)}
            </select>
          </div>
          <div className="form-row">
            <label>Title</label>
            <input value={f.title ?? ""} onChange={(e) => set("title", e.target.value)} placeholder="Short description" />
          </div>
          <div className="form-grid">
            <div className="form-row">
              <label>Start Date</label>
              <input type="date" value={f.start ?? ""} onChange={(e) => set("start", e.target.value)} />
            </div>
            <div className="form-row">
              <label>End Date</label>
              <input type="date" value={f.end ?? ""} onChange={(e) => set("end", e.target.value)} />
            </div>
          </div>
          <div className="form-row">
            <label>Assigned Pilot</label>
            <input value={f.pilot ?? ""} onChange={(e) => set("pilot", e.target.value)} placeholder="Pilot name" />
          </div>
          <div className="form-row">
            <label>Notes</label>
            <input value={f.notes ?? ""} onChange={(e) => set("notes", e.target.value)} />
          </div>
          <div className="form-actions">
            <button className="btn-cancel" onClick={() => setModal(null)}>Cancel</button>
            <button className="btn-save" onClick={submit} disabled={busy}>
              {busy ? "Saving…" : "Save Event"}
            </button>
          </div>
        </Modal>
      )}

      {confirmIdx != null && (
        <Confirm
          message={<>Delete “<b>{all[confirmIdx]?.title || all[confirmIdx]?.type}</b>”?</>}
          onConfirm={() => remove(confirmIdx)}
          onCancel={() => setConfirmIdx(null)}
        />
      )}
    </>
  );
}
