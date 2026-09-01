"use client";

import { useEffect, useState } from "react";
import { CORE_INSP, ic, INSP_BADGE, intervalText, METER_LABEL, today, type Insp } from "@/lib/aircraft";
import type { TabProps } from "../detail-client";
import { Modal } from "@/components/ui/modal";
import { Confirm } from "@/components/ui/confirm";
import { RowMenu } from "@/components/ui/row-menu";
import { useToast } from "@/components/ui/toast";

type FormState = {
  type: string;
  custom: string;
  intType: "days" | "hours";
  intVal: string;
  date: string;
  hobbs: string;
  by: string;
};

const blankForm = (hrs: number): FormState => ({
  type: CORE_INSP[0].name,
  custom: "",
  intType: "days",
  intVal: "",
  date: today(),
  hobbs: hrs > 0 ? hrs.toFixed(1) : "",
  by: "",
});

export function InspectionsTab({
  data, maintHrs, aircraft, save, consumeAction, allow, focusInsp, clearFocusInsp,
}: TabProps) {
  const all = (data.inspections ?? []) as Insp[];
  const active = all.map((i, idx) => ({ i, idx })).filter((x) => !x.i.inactive);
  const inactive = all.map((i, idx) => ({ i, idx })).filter((x) => x.i.inactive);

  const toast = useToast();
  // Opens straight into the modal when the dashboard's "Log Inspection" quick
  // action routed here — resolved at mount, so no effect and no extra render.
  const [modal, setModal] = useState<null | { mode: "add" | "edit"; idx?: number }>(
    () => (consumeAction("log-inspection") ? { mode: "add" } : null),
  );
  const [form, setForm] = useState<FormState>(blankForm(maintHrs));
  const [busy, setBusy] = useState(false);
  const [showInactive, setShowInactive] = useState(false);
  const [confirmClear, setConfirmClear] = useState<number | null>(null);
  const [confirmComply, setConfirmComply] = useState<number | null>(null);
  const [confirmDeactivate, setConfirmDeactivate] = useState<number | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<number | null>(null);

  // Deep-link from the dashboard alert feed / next-due card (v1's preInsp).
  const highlight = focusInsp;
  useEffect(() => {
    if (focusInsp == null) return;
    const t = setTimeout(clearFocusInsp, 2200);
    return () => clearTimeout(t);
  }, [focusInsp, clearFocusInsp]);

  function openAdd() {
    setForm(blankForm(maintHrs));
    setModal({ mode: "add" });
  }

  const set = (k: keyof FormState, v: string) => setForm((f) => ({ ...f, [k]: v }));
  const corePreset = CORE_INSP.find((c) => c.name === form.type);
  const isCustom = form.type === "Custom...";

  function openEdit(idx: number) {
    const i = all[idx];
    const preset = CORE_INSP.find((c) => c.name === i.name);
    setForm({
      type: preset ? i.name : "Custom...",
      custom: preset ? "" : i.name,
      intType: i.intervalHrs ? "hours" : "days",
      intVal: String(i.intervalHrs ?? i.intervalDays ?? ""),
      date: i.lastDate ?? today(),
      hobbs: i.lastHobbs != null ? String(i.lastHobbs) : "",
      by: i.by ?? "",
    });
    setModal({ mode: "edit", idx });
  }

  async function submit() {
    const name = isCustom ? form.custom.trim() : form.type;
    if (!name) { toast("Give the inspection a name.", "warn"); return; }
    setBusy(true);

    const intervalHrs = corePreset
      ? corePreset.intervalHrs
      : form.intType === "hours" ? Number(form.intVal) || null : null;
    const intervalDays = corePreset
      ? corePreset.intervalDays
      : form.intType === "days" ? Number(form.intVal) || null : null;

    const entry: Insp = {
      name,
      core: !!corePreset,
      intervalHrs,
      intervalDays,
      intervalLabel: corePreset?.intervalLabel,
      lastDate: form.date || null,
      lastHobbs: form.hobbs === "" ? null : Number(form.hobbs),
      by: form.by.trim() || null,
      updatedOn: today(),
      populated: true,
    };

    let next: Insp[];
    if (modal?.mode === "edit" && modal.idx != null) {
      const at = modal.idx;
      next = all.map((x, k) => (k === at ? { ...x, ...entry } : x));
    } else {
      // Logging against an existing (e.g. never-recorded) row updates it in
      // place rather than creating a duplicate — v1's saveInspection behaviour.
      const existing = all.findIndex((x) => x.name === name);
      next = existing >= 0
        ? all.map((x, k) => (k === existing ? { ...x, ...entry, inactive: false } : x))
        : [...all, entry];
    }

    await save({ ...data, inspections: next });
    setBusy(false);
    setModal(null);
    toast(`${name} recorded`, "ok");
  }

  // "Complied today" — records today's date + current maintenance-clock hours,
  // exactly what the mechanic sign-off captures.
  async function markComplied(idx: number) {
    if (!(maintHrs > 0) && all[idx].intervalHrs) {
      toast("Set the aircraft's current hours first (Settings).", "warn");
      return;
    }
    const next = all.map((insp, k) =>
      k === idx
        ? {
            ...insp,
            lastDate: today(),
            lastHobbs: Number(maintHrs.toFixed(1)),
            updatedOn: today(),
            populated: true,
          }
        : insp,
    );
    await save({ ...data, inspections: next });
    toast(`${all[idx].name} marked complied`, "ok");
  }

  async function toggleActive(idx: number) {
    const was = all[idx].inactive;
    const next = all.map((x, k) => (k === idx ? { ...x, inactive: !x.inactive } : x));
    await save({ ...data, inspections: next });
    toast(`${all[idx].name} ${was ? "reactivated" : "deactivated"}`, "ok");
  }

  async function doClear(idx: number) {
    const next = all.map((x, k) =>
      k === idx
        ? { ...x, lastDate: null, lastHobbs: null, by: null, updatedOn: null, populated: false }
        : x,
    );
    await save({ ...data, inspections: next });
    setConfirmClear(null);
    toast(`${all[idx].name} cleared`, "ok");
  }

  // Only non-core rows can be removed outright — v1 hid Delete Row for the
  // seven regulatory inspections.
  async function doDelete(idx: number) {
    const name = all[idx].name;
    await save({ ...data, inspections: all.filter((_, k) => k !== idx) });
    setConfirmDelete(null);
    toast(`${name} removed`, "ok");
  }

  // Neutral chip used for NOT SET / INACTIVE, matching v1's inline style.
  const dimBadge = {
    background: "var(--bg4)",
    color: "var(--muted)",
    borderColor: "var(--border2)",
  };

  /** Mirrors v1's _inspRow(): three distinct row shapes. */
  function row({ i, idx }: { i: Insp; idx: number }, isInactive = false) {
    const st = ic(i, maintHrs);
    const unpop = st.s === "none";
    const interval = intervalText(i);

    if (isInactive) {
      return (
        <tr key={idx} style={{ opacity: 0.45 }}>
          <td style={{ fontWeight: 600 }}>{i.name}</td>
          <td><span className="badge" style={dimBadge}>INACTIVE</span></td>
          <td className="mono" style={{ color: "var(--muted)" }}>{i.lastDate || "—"}</td>
          <td className="mono" style={{ color: "var(--muted)" }}>{unpop ? "—" : st.nl}</td>
          <td className="mono">{interval}</td>
          <td style={{ fontSize: 12, color: "var(--muted)" }}>{i.by || "—"}</td>
          <td className="mono" style={{ color: "var(--muted)" }}>{i.updatedOn || "—"}</td>
          <td>
            <div className="action-cell">
              <button className="action-btn" onClick={() => toggleActive(idx)}>Reactivate</button>
            </div>
          </td>
        </tr>
      );
    }

    const menu = [
      ...(unpop ? [] : [{ label: "Edit entry", onClick: () => openEdit(idx) }]),
      ...(unpop ? [] : [{ label: "Clear entry", onClick: () => setConfirmClear(idx), danger: true }]),
      { label: "Deactivate", onClick: () => setConfirmDeactivate(idx), danger: true },
      ...(i.core ? [] : [{ label: "Delete row", onClick: () => setConfirmDelete(idx), danger: true }]),
    ];

    const dim = unpop ? { opacity: 0.5 } : undefined;

    return (
      <tr key={idx} style={highlight === idx ? { outline: "1px solid var(--accent)" } : undefined}>
        <td style={{ fontWeight: 600, ...dim }}>{i.name}</td>
        <td style={dim}>
          {unpop
            ? <span className="badge" style={dimBadge}>NOT SET</span>
            : <span className={`badge ${INSP_BADGE[st.s].cls}`}>{INSP_BADGE[st.s].label}</span>}
        </td>
        <td className="mono" style={{ color: unpop ? "var(--muted)" : undefined, ...dim }}>
          {unpop ? "—" : i.lastDate}
        </td>
        <td className="mono" style={{ color: unpop ? "var(--muted)" : undefined, ...dim }}>
          {unpop ? "—" : st.nl}
        </td>
        <td className="mono" style={dim}>{interval}</td>
        <td style={{ fontSize: 12, color: unpop ? "var(--muted)" : "var(--muted2)", ...dim }}>
          {unpop ? "—" : i.by || "—"}
        </td>
        <td className="mono" style={{ color: unpop ? "var(--muted)" : undefined, ...dim }}>
          {unpop ? "—" : i.updatedOn || "—"}
        </td>
        <td>
          <div className="action-cell">
            <button className="action-btn" onClick={() => (unpop ? openEdit(idx) : setConfirmComply(idx))}>
              {unpop ? "Log First" : "Update"}
            </button>
            <RowMenu items={menu} label={i.name} />
          </div>
        </td>
      </tr>
    );
  }

  const head = (
    <thead>
      <tr>
        <th>Inspection Type</th><th>Status</th><th>Last Serviced</th>
        <th>Next Service</th><th>Interval</th><th>Updated By</th>
        <th>Updated On</th><th>Actions</th>
      </tr>
    </thead>
  );

  return (
    <>
      {/* An hour-based inspection pinned to a meter reading zero can never be
          computed — it just shows NO HOURS forever with nothing saying why. */}
      {!(maintHrs > 0) && all.some((i) => i.intervalHrs && !i.inactive) && (
        <div className="grant-msg warn" style={{ marginBottom: 10 }}>
          Hour-based inspections can&rsquo;t be tracked: this aircraft&rsquo;s
          maintenance clock is <b>{METER_LABEL[aircraft.maint_basis]}</b>, which
          reads 0.0. Set the current hours — or point the maintenance clock at
          the meter you actually track — in Aircraft Settings.
        </div>
      )}

      <div className="tbl-toolbar">
        <span className="mono" style={{ marginRight: "auto" }}>
          measured against {METER_LABEL[aircraft.maint_basis].toLowerCase()} · {maintHrs.toFixed(1)} hrs
        </span>
        {allow("inspection") && (
          <button className="btn sm primary" onClick={openAdd}>Log Inspection</button>
        )}
      </div>

      <div className="table-scroll">
        <table className="data-table">
          {head}
          <tbody>
            {active.length === 0 ? (
              <tr>
                <td colSpan={8} style={{ color: "var(--muted2)" }}>
                  No inspections recorded. Use <b>Log Inspection</b> to add one.
                </td>
              </tr>
            ) : (
              active.map((x) => row(x))
            )}
            {/* Inactive section lives inside the same table, as it does in v1. */}
            {inactive.length > 0 && (
              <tr style={{ cursor: "pointer" }} onClick={() => setShowInactive((s) => !s)}>
                <td
                  colSpan={8}
                  style={{
                    padding: "10px 16px",
                    background: "var(--bg3)",
                    borderTop: "1px solid var(--border2)",
                  }}
                >
                  <span className="archive-hd-lbl">
                    Inactive ({inactive.length}){" "}
                    <span style={{ fontSize: 10 }}>{showInactive ? "▼ hide" : "▶ show"}</span>
                  </span>
                </td>
              </tr>
            )}
            {showInactive && inactive.map((x) => row(x, true))}
          </tbody>
        </table>
      </div>

      {modal && (
        <Modal
          title={modal.mode === "edit" ? "Edit Inspection" : "Log Inspection"}
          onClose={() => setModal(null)}
        >
          <div className="form-row">
            <label>Inspection Type</label>
            <select value={form.type} onChange={(e) => set("type", e.target.value)}>
              {CORE_INSP.map((c) => <option key={c.name}>{c.name}</option>)}
              <option>Custom...</option>
            </select>
          </div>

          {isCustom && (
            <div className="form-row">
              <label>Custom Name</label>
              <input value={form.custom} onChange={(e) => set("custom", e.target.value)} placeholder="Prop overhaul" />
            </div>
          )}

          {corePreset ? (
            <div className="how-box" style={{ marginBottom: 12 }}>
              <span className="mono" style={{ display: "block", marginBottom: 3 }}>REGULATORY INTERVAL</span>
              <b>{corePreset.intervalLabel}</b>
            </div>
          ) : (
            <div className="form-grid">
              <div className="form-row">
                <label>Interval Type</label>
                <select value={form.intType} onChange={(e) => set("intType", e.target.value)}>
                  <option value="days">Days / Calendar</option>
                  <option value="hours">Hours</option>
                </select>
              </div>
              <div className="form-row">
                <label>Interval</label>
                <input
                  type="number"
                  value={form.intVal}
                  onChange={(e) => set("intVal", e.target.value)}
                  placeholder={form.intType === "hours" ? "100" : "365"}
                />
              </div>
            </div>
          )}

          <div className="form-grid">
            <div className="form-row">
              <label>Date Completed</label>
              <input type="date" value={form.date} onChange={(e) => set("date", e.target.value)} />
            </div>
            <div className="form-row">
              <label>Hours at Completion</label>
              <input
                type="number" step="0.1"
                value={form.hobbs}
                onChange={(e) => set("hobbs", e.target.value)}
                placeholder={maintHrs > 0 ? maintHrs.toFixed(1) : "1243"}
              />
            </div>
          </div>

          <div className="form-row">
            <label>Performed By</label>
            <input value={form.by} onChange={(e) => set("by", e.target.value)} placeholder="Name or shop…" />
          </div>

          <div className="form-actions">
            <button className="btn-cancel" onClick={() => setModal(null)}>Cancel</button>
            <button className="btn-save" onClick={submit} disabled={busy}>
              {busy ? "Saving…" : "Save"}
            </button>
          </div>
        </Modal>
      )}

      {confirmDeactivate != null && (
        <Confirm
          title="Deactivate inspection"
          message={
            <>
              Stop tracking <b>{all[confirmDeactivate]?.name}</b>? It moves to the
              Inactive list and no longer counts towards this aircraft&rsquo;s
              status. Nothing recorded is deleted, and you can reactivate it at
              any time.
            </>
          }
          confirmLabel="Deactivate"
          onConfirm={() => { const i = confirmDeactivate; setConfirmDeactivate(null); toggleActive(i); }}
          onCancel={() => setConfirmDeactivate(null)}
        />
      )}

      {confirmComply != null && (
        <Confirm
          title="Mark inspection complied"
          message={
            <>
              Record <b>{all[confirmComply]?.name}</b> as complied on{" "}
              <b>{today()}</b>
              {all[confirmComply]?.intervalHrs ? <> at <b>{maintHrs.toFixed(1)} hrs</b></> : null}?
              {all[confirmComply]?.lastDate ? (
                <> This replaces the current record of <b>{all[confirmComply]?.lastDate}</b>.</>
              ) : null}
            </>
          }
          confirmLabel="Mark complied"
          onConfirm={() => { const i = confirmComply; setConfirmComply(null); markComplied(i); }}
          onCancel={() => setConfirmComply(null)}
        />
      )}

      {confirmClear != null && (
        <Confirm
          title="Clear inspection record"
          message={
            <>
              Clear the recorded compliance for <b>{all[confirmClear]?.name}</b>? The
              inspection stays in the list but returns to <b>NOT SET</b>.
            </>
          }
          confirmLabel="Clear record"
          onConfirm={() => doClear(confirmClear)}
          onCancel={() => setConfirmClear(null)}
        />
      )}

      {confirmDelete != null && (
        <Confirm
          title="Delete inspection row"
          message={<>Remove <b>{all[confirmDelete]?.name}</b> from this aircraft entirely?</>}
          confirmLabel="Delete row"
          onConfirm={() => doDelete(confirmDelete)}
          onCancel={() => setConfirmDelete(null)}
        />
      )}
    </>
  );
}
