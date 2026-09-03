"use client";

import { useState } from "react";
import { METER_LABEL, monthLabel, oilLife, readMonthly, today, type OilEntry } from "@/lib/aircraft";
import type { TabProps } from "../detail-client";
import { Modal } from "@/components/ui/modal";
import { Confirm } from "@/components/ui/confirm";
import { LabeledBarChart } from "@/components/ui/charts";
import { useToast } from "@/components/ui/toast";

// v1's Oil tab is "Oil and Fluids" — the entry modal offered a fluid-type
// select, not a free-text oil name.
const FLUIDS = ["Engine Oil", "Hydraulic Fluid", "Brake Fluid", "Coolant", "Other"];

export function OilTab({ data, maintHrs, save, consumeAction, aircraft }: TabProps) {
  const entries = (data.oil ?? []) as OilEntry[];
  const life = oilLife(data, maintHrs);
  const toast = useToast();

  const barColor = !life.tracked
    ? "var(--muted2)"
    : life.pct <= 0 ? "var(--danger)" : life.pct < 15 ? "var(--warn)" : "var(--ok)";

  // Opens straight into the right entry modal when routed from the dashboard's
  // "Log Oil" / "Oil Change" quick actions.
  const [modal, setModal] = useState<null | { mode: "add" | "change"; idx?: number }>(() =>
    consumeAction("oil-change") ? { mode: "change" }
      : consumeAction("log-oil") ? { mode: "add" }
        : null,
  );
  const [form, setForm] = useState<OilEntry>({
    date: today(),
    hobbs: maintHrs > 0 ? Number(maintHrs.toFixed(1)) : undefined,
    type: FLUIDS[0],
  });
  const [busy, setBusy] = useState(false);
  const [confirmIdx, setConfirmIdx] = useState<number | null>(null);

  function openNew(mode: "add" | "change") {
    setForm({
      date: today(),
      hobbs: maintHrs > 0 ? Number(maintHrs.toFixed(1)) : undefined,
      type: FLUIDS[0],
    });
    setModal({ mode });
  }

  function openEdit(idx: number) {
    const e = entries[idx];
    setForm({ ...e });
    setModal({ mode: e.kind === "change" ? "change" : "add", idx });
  }

  async function submit() {
    setBusy(true);
    const isChange = modal?.mode === "change";
    const entry: OilEntry = { ...form, kind: isChange ? "change" : "add" };

    let nextOil: OilEntry[];
    if (modal?.idx != null) {
      const at = modal.idx;
      nextOil = entries.map((e, k) => (k === at ? entry : e));
    } else {
      nextOil = [entry, ...entries];
    }

    const nextData = { ...data, oil: nextOil };
    // An oil change resets the oil-life clock to the hours at the change.
    if (isChange) {
      nextData.oilHobbs = entry.hobbs ?? Number(maintHrs.toFixed(1));
      nextData.oilChangeDate = form.date;
    }
    await save(nextData);
    setBusy(false);
    setModal(null);
    toast(isChange ? "Oil change recorded" : "Oil entry saved", "ok");
  }

  async function remove(idx: number) {
    await save({ ...data, oil: entries.filter((_, k) => k !== idx) });
    setConfirmIdx(null);
    toast("Entry deleted", "ok");
  }

  // Stats, ported from renderOilStats(): total added, monthly average and
  // consumption per 10 hours — none of which survived the first port.
  const adds = entries.filter((e) => e.kind !== "change");
  const totalAdded = adds.reduce((s, e) => s + (Number(e.qty) || 0), 0);
  const byMonth = readMonthly(data.oilByMonth, 6);
  // v1 averages over the whole window, including zero months — not just the
  // months that had an entry.
  const avgMonth = byMonth.length
    ? byMonth.reduce((s, m) => s + m.hours, 0) / byMonth.length
    : 0;

  // Quarts per 10 hours since the last oil change. v1 divided unconditionally
  // and printed "NaN qt" before the first flight; show "—" instead.
  const consumption = life.used > 0 ? (totalAdded / life.used) * 10 : null;

  return (
    <>
      <div className="tbl-toolbar">
        <button className="btn sm" onClick={() => openNew("add")}>Log Oil Addition</button>
        <button className="btn primary sm" onClick={() => openNew("change")}>Log Oil Change</button>
      </div>

      <div className="stat-row" style={{ gridTemplateColumns: "repeat(4,1fr)" }}>
        <div className="stat-box">
          <div className="stat-lbl">Oil Life</div>
          <div className="stat-val" style={{ color: barColor }}>
            {life.tracked ? `${Math.round(life.pct)}%` : "—"}
          </div>
          <div className="stat-sub">
            {life.tracked
              ? life.hrsLeft >= 0
                ? `${life.hrsLeft.toFixed(1)} hrs left · ${life.interval}hr interval`
                : `${life.overdueHrs.toFixed(1)} hrs overdue`
              : !life.applicable
                ? "serviced on condition — no hour interval"
                : life.hasRecord
                  ? `${METER_LABEL[aircraft.maint_basis].toLowerCase()} reads 0 — can't measure`
                  : "no oil change recorded"}
          </div>
        </div>
        <div className="stat-box">
          <div className="stat-lbl">Total Added</div>
          <div className="stat-val">{totalAdded.toFixed(1)} qt</div>
          <div className="stat-sub">
            {adds.length} top-up{adds.length === 1 ? "" : "s"} · excludes changes
          </div>
        </div>
        <div className="stat-box">
          <div className="stat-lbl">Avg / Month</div>
          <div className="stat-val">{avgMonth.toFixed(2)} qt</div>
          <div className="stat-sub">6-month avg · includes changes</div>
        </div>
        <div className="stat-box">
          <div className="stat-lbl">Consumption</div>
          <div className="stat-val">{consumption != null ? `${consumption.toFixed(1)} qt` : "— qt"}</div>
          <div className="stat-sub">per 10 hrs</div>
        </div>
      </div>

      <div className="two-col">
        <div className="panel">
          <div className="panel-title">Monthly Oil Consumption (quarts)</div>
          <LabeledBarChart
            labels={byMonth.map((m) => monthLabel(m.month))}
            data={byMonth.map((m) => m.hours)}
            color="var(--ok)"
          />
        </div>
        <div className="panel">
          <div className="panel-title">Recent Log</div>
          <ul className="log-list">
            {entries.length === 0 ? (
              <li className="log-item" style={{ color: "var(--muted2)" }}>No oil entries.</li>
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
                  <span className="action-cell">
                    <button className="action-btn" onClick={() => openEdit(idx)}>Edit</button>
                    <button className="action-btn del" onClick={() => setConfirmIdx(idx)}>Delete</button>
                  </span>
                </li>
              ))
            )}
          </ul>
        </div>
      </div>

      {modal && (
        <Modal
          title={
            modal.idx != null
              ? "Edit Entry"
              : modal.mode === "change" ? "Log Oil Change" : "Log Oil Addition"
          }
          onClose={() => setModal(null)}
        >
          {/* Entry Type is switchable inside the modal, as in v1 — the two
              toolbar buttons just preselect it. */}
          <div className="form-row">
            <label>Entry Type</label>
            <select
              value={modal.mode}
              onChange={(e) =>
                setModal((m) => (m ? { ...m, mode: e.target.value as "add" | "change" } : m))
              }
            >
              <option value="add">Oil Added (top-off)</option>
              <option value="change">Oil Change (reset clock)</option>
            </select>
          </div>
          <div className="form-row">
            <label>Fluid Type</label>
            <select value={form.type ?? FLUIDS[0]} onChange={(e) => setForm((f) => ({ ...f, type: e.target.value }))}>
              {FLUIDS.map((t) => <option key={t}>{t}</option>)}
            </select>
          </div>
          <div className="form-grid">
            {modal.mode === "add" && (
              <div className="form-row">
                <label>Quantity (quarts)</label>
                <input
                  type="number" step="0.25"
                  value={form.qty ?? ""}
                  onChange={(e) => setForm((f) => ({ ...f, qty: e.target.value === "" ? undefined : Number(e.target.value) }))}
                  placeholder="1"
                />
              </div>
            )}
            <div className="form-row">
              <label>Date</label>
              <input type="date" value={form.date} onChange={(e) => setForm((f) => ({ ...f, date: e.target.value }))} />
            </div>
          </div>
          <div className="form-row">
            <label>Hobbs / Tach Time</label>
            <input
              type="number" step="0.1"
              value={form.hobbs ?? ""}
              onChange={(e) => setForm((f) => ({ ...f, hobbs: e.target.value === "" ? undefined : Number(e.target.value) }))}
              placeholder={maintHrs > 0 ? maintHrs.toFixed(1) : "1243"}
            />
          </div>
          <div className="form-row">
            <label>Notes</label>
            <input
              value={form.notes ?? ""}
              onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
              placeholder="Grade, brand, etc."
            />
          </div>
          {modal.mode === "change" && (
            <div className="how-box" style={{ marginBottom: 0 }}>
              Recording an oil change resets the oil-life clock to{" "}
              <b>{(form.hobbs ?? maintHrs).toFixed?.(1) ?? form.hobbs} hrs</b>.
            </div>
          )}
          <div className="form-actions">
            <button className="btn-cancel" onClick={() => setModal(null)}>Cancel</button>
            <button className="btn-save" onClick={submit} disabled={busy}>
              {busy ? "Saving…" : "Save"}
            </button>
          </div>
        </Modal>
      )}

      {confirmIdx != null && (
        <Confirm
          message={<>Delete the {entries[confirmIdx]?.date} entry?</>}
          onConfirm={() => remove(confirmIdx)}
          onCancel={() => setConfirmIdx(null)}
        />
      )}
    </>
  );
}
