"use client";

import { useEffect, useMemo, useState } from "react";
import {
  dueInShort, fmtDate, ic, intervalShort, today, type Insp, type InspStatus,
} from "@/lib/aircraft";
import { Modal } from "@/components/ui/modal";
import { Confirm } from "@/components/ui/confirm";
import { RowMenu } from "@/components/ui/row-menu";
import { Icon } from "@/components/ui/icon";
import { useToast } from "@/components/ui/toast";

/**
 * The inspections table, laid out as Cirrus IQ lays out its Inspection
 * Manager: Due In leads with a bar and a short countdown, Last Serviced
 * carries date and hours, Next Service is the plain figure, unactivated rows
 * stay in the table with an Activate button, and the row menu offers Edit,
 * Set Reminder and Deactivate. Bulk actions and Filter & Sort sit above.
 *
 * Shared by the Inspections tab and the Life Limited Parts tab; the caller
 * supplies the rows, the presets, and how to save.
 */

type View = "all" | "hours" | "date";
type Sort = "default" | "az" | "za";

type FormState = {
  type: string;
  custom: string;
  intType: "days" | "hours" | "both";
  intHrs: string;
  intDays: string;
  date: string;
  hobbs: string;
  by: string;
};

const STATUS_CLS: Record<InspStatus, string> = {
  none: "none", unknown: "unknown", ok: "ok", warn: "warn", overdue: "overdue",
};

export function InspTable({
  items, presets, save, maintHrs, canEdit, focus, clearFocus, openAddOnMount, groups, addLabel = "Log Inspection", noun = "inspection",
}: {
  items: Insp[];
  /** The class's core set: the type dropdown for a custom row, and the interval a preset carries. */
  presets: Insp[];
  save: (next: Insp[]) => Promise<void>;
  maintHrs: number;
  canEdit: boolean;
  /** Row index to highlight once (dashboard deep link). */
  focus?: number | null;
  clearFocus?: () => void;
  openAddOnMount?: boolean;
  /** Split into "Airworthiness Items" and "General Items" tables. */
  groups?: boolean;
  addLabel?: string;
  noun?: string;
}) {
  const toast = useToast();
  const [view, setView] = useState<View>("all");
  const [sort, setSort] = useState<Sort>("default");
  const [filterOpen, setFilterOpen] = useState(false);
  const [selected, setSelected] = useState<Set<number>>(new Set());
  // Bulk selection mode: checkboxes appear only after a bulk action is chosen,
  // and only on the rows that action applies to, as Cirrus IQ does it.
  const [mode, setMode] = useState<null | "activate" | "update" | "deactivate">(null);
  const [busy, setBusy] = useState(false);

  // Dialogs, keyed by row index where they apply.
  const [update, setUpdate] = useState<number | null>(null);
  const [edit, setEdit] = useState<number | null>(null);
  const [reminder, setReminder] = useState<number | null>(null);
  const [activate, setActivate] = useState<number | null>(null);
  const [deactivate, setDeactivate] = useState<number | null>(null);
  const [remove, setRemove] = useState<number | null>(null);
  const [bulk, setBulk] = useState<null | "activate" | "update" | "deactivate">(null);
  const [add, setAdd] = useState(!!openAddOnMount);

  const [form, setForm] = useState<FormState>(() => blank(presets, maintHrs));
  const [hours, setHours] = useState("");
  const [date, setDate] = useState(today());
  const [by, setBy] = useState("");
  const [remHrs, setRemHrs] = useState("");
  const [remDate, setRemDate] = useState("");

  useEffect(() => {
    if (focus == null || !clearFocus) return;
    const t = setTimeout(clearFocus, 2200);
    return () => clearTimeout(t);
  }, [focus, clearFocus]);

  const rows = useMemo(() => {
    const withIdx = items.map((i, idx) => ({ i, idx, st: ic(i, maintHrs) }));
    const live = (r: typeof withIdx[number]) => !r.i.inactive && r.st.s !== "none";
    let list = withIdx.filter((r) => {
      if (view === "hours") return !!r.i.intervalHrs;
      if (view === "date") return !!r.i.intervalDays;
      return true;
    });
    if (sort === "az") list = [...list].sort((a, b) => a.i.name.localeCompare(b.i.name));
    else if (sort === "za") list = [...list].sort((a, b) => b.i.name.localeCompare(a.i.name));
    else list = [...list].sort((a, b) => Number(live(b)) - Number(live(a)));
    return list;
  }, [items, maintHrs, view, sort]);

  const commit = async (next: Insp[], msg: string) => {
    setBusy(true);
    try {
      await save(next);
      toast(msg, "ok");
    } finally {
      setBusy(false);
    }
  };

  const stamp = (i: Insp, patch: Partial<Insp>): Insp => ({ ...i, ...patch, updatedOn: today() });

  // ── Row actions ───────────────────────────────────────────────────────
  function openUpdate(idx: number) {
    setHours(maintHrs > 0 ? maintHrs.toFixed(1) : "");
    setDate(today());
    setBy(items[idx].by ?? "");
    setUpdate(idx);
  }
  async function doUpdate() {
    if (update == null) return;
    const i = items[update];
    const next = items.map((x, k) => k === update
      ? stamp(x, { lastDate: date || null, lastHobbs: hours === "" ? null : Number(hours), by: by.trim() || null, populated: true, inactive: false })
      : x);
    setUpdate(null);
    await commit(next, `${i.name} updated`);
  }

  function openEdit(idx: number) {
    const i = items[idx];
    setHours(i.lastHobbs != null ? String(i.lastHobbs) : "");
    setDate(i.lastDate ?? today());
    setBy(i.by ?? "");
    setForm({
      type: i.name, custom: i.name,
      intType: i.intervalHrs && i.intervalDays ? "both" : i.intervalHrs ? "hours" : "days",
      intHrs: i.intervalHrs ? String(i.intervalHrs) : "",
      intDays: i.intervalDays ? String(i.intervalDays) : "",
      date: i.lastDate ?? today(), hobbs: i.lastHobbs != null ? String(i.lastHobbs) : "", by: i.by ?? "",
    });
    setEdit(idx);
  }
  async function doEdit() {
    if (edit == null) return;
    const i = items[edit];
    const custom = !i.core;
    const next = items.map((x, k) => k === edit
      ? stamp(x, {
          name: custom ? form.custom.trim() || x.name : x.name,
          intervalHrs: custom && form.intType !== "days" ? Number(form.intHrs) || null : x.intervalHrs,
          intervalDays: custom && form.intType !== "hours" ? Number(form.intDays) || null : x.intervalDays,
          lastDate: date || null,
          lastHobbs: hours === "" ? null : Number(hours),
          by: by.trim() || null,
          populated: !!(date || hours !== ""),
        })
      : x);
    setEdit(null);
    await commit(next, `${i.name} saved`);
  }

  function openReminder(idx: number) {
    const i = items[idx];
    const st = ic(i, maintHrs);
    setRemHrs(i.reminderHrs != null ? String(i.reminderHrs) : i.intervalHrs && i.lastHobbs != null ? (i.lastHobbs + i.intervalHrs).toFixed(1) : "");
    setRemDate(i.reminderDate ?? (i.intervalDays && st.due && /^\d{4}-\d{2}-\d{2}$/.test(st.due) ? st.due : ""));
    setReminder(idx);
  }
  async function doReminder() {
    if (reminder == null) return;
    const i = items[reminder];
    const next = items.map((x, k) => k === reminder
      ? { ...x, reminderHrs: x.intervalHrs && remHrs !== "" ? Number(remHrs) : null, reminderDate: x.intervalDays && remDate ? remDate : null }
      : x);
    setReminder(null);
    await commit(next, `Reminder set for ${i.name}`);
  }
  async function clearReminder(idx: number) {
    const next = items.map((x, k) => k === idx ? { ...x, reminderHrs: null, reminderDate: null } : x);
    setReminder(null);
    await commit(next, `Reminder cleared`);
  }

  // Activate: "Has it been completed on this aircraft before?" Yes takes the
  // last-serviced figures; No starts the clock from today at the current hours.
  async function activateNow(idx: number) {
    const i = items[idx];
    const next = items.map((x, k) => k === idx
      ? stamp(x, { lastDate: today(), lastHobbs: maintHrs > 0 ? Number(maintHrs.toFixed(1)) : null, populated: true, inactive: false, by: null })
      : x);
    setActivate(null);
    await commit(next, `${i.name} activated — clock starts today`);
  }
  async function doDeactivate(idx: number) {
    const i = items[idx];
    setDeactivate(null);
    await commit(items.map((x, k) => k === idx ? { ...x, inactive: true } : x), `${i.name} deactivated`);
  }
  async function doRemove(idx: number) {
    const name = items[idx].name;
    setRemove(null);
    await commit(items.filter((_, k) => k !== idx), `${name} removed`);
  }

  // ── Bulk ───────────────────────────────────────────────────────────────
  const sel = [...selected].filter((k) => items[k]);
  const isUnset = (k: number) => items[k].inactive || ic(items[k], maintHrs).s === "none";
  const selUnset = sel.filter(isUnset);
  const selLive = sel.filter((k) => !isUnset(k));
  const eligible = (k: number) => mode === "activate" ? isUnset(k) : mode ? !isUnset(k) : false;
  const enterMode = (m: NonNullable<typeof mode>) => { setMode(m); setSelected(new Set()); };
  const leaveMode = () => { setMode(null); setSelected(new Set()); };
  async function doBulk() {
    if (!bulk) return;
    const t = today();
    const h = maintHrs > 0 ? Number(maintHrs.toFixed(1)) : null;
    const set = new Set(bulk === "activate" ? selUnset : selLive);
    const next = items.map((x, k) => {
      if (!set.has(k)) return x;
      if (bulk === "deactivate") return { ...x, inactive: true };
      return stamp(x, { lastDate: t, lastHobbs: h, populated: true, inactive: false });
    });
    setBulk(null);
    leaveMode();
    await commit(next, `${set.size} ${set.size === 1 ? noun : noun + "s"} ${bulk === "deactivate" ? "deactivated" : bulk === "activate" ? "activated" : "updated"}`);
  }

  // ── Add (custom row) ───────────────────────────────────────────────────
  const preset = presets.find((c) => c.name === form.type && (c.intervalHrs || c.intervalDays));
  const isCustom = form.type === "Custom...";
  async function doAdd() {
    const name = isCustom ? form.custom.trim() : form.type;
    if (!name) { toast(`Give the ${noun} a name.`, "warn"); return; }
    const entry: Insp = {
      name,
      core: !!preset,
      intervalHrs: preset ? preset.intervalHrs : form.intType !== "days" ? Number(form.intHrs) || null : null,
      intervalDays: preset ? preset.intervalDays : form.intType !== "hours" ? Number(form.intDays) || null : null,
      intervalLabel: preset?.intervalLabel,
      lastDate: form.date || null,
      lastHobbs: form.hobbs === "" ? null : Number(form.hobbs),
      by: form.by.trim() || null,
      updatedOn: today(),
      populated: true,
      group: preset?.group,
    };
    const existing = items.findIndex((x) => x.name === name);
    const next = existing >= 0
      ? items.map((x, k) => (k === existing ? { ...x, ...entry, inactive: false } : x))
      : [...items, entry];
    setAdd(false);
    await commit(next, `${name} recorded`);
  }

  // ── Render ─────────────────────────────────────────────────────────────
  const toggle = (idx: number) => setSelected((s) => { const n = new Set(s); if (n.has(idx)) n.delete(idx); else n.add(idx); return n; });

  function renderRow({ i, idx, st }: { i: Insp; idx: number; st: ReturnType<typeof ic> }) {
    const unset = i.inactive || st.s === "none";
    const cls = i.inactive ? "inactive" : STATUS_CLS[st.s];
    const hasReminder = i.reminderHrs != null || !!i.reminderDate;
    const menu = unset
      ? [...(i.core ? [] : [{ label: "Delete row", onClick: () => setRemove(idx), danger: true }])]
      : [
          { label: "Edit", onClick: () => openEdit(idx) },
          { label: hasReminder ? "Change reminder" : "Set reminder", onClick: () => openReminder(idx) },
          { label: "Deactivate", onClick: () => setDeactivate(idx) },
          ...(i.core ? [] : [{ label: "Delete row", onClick: () => setRemove(idx), danger: true }]),
        ];
    return (
      <tr key={idx} className={`insp-row ${cls}${focus === idx ? " row-focus" : ""}${selected.has(idx) ? " selected" : ""}`}>
        {mode && (
          <td className="insp-check">
            {eligible(idx) && (
              <input type="checkbox" checked={selected.has(idx)} onChange={() => toggle(idx)} aria-label={`Select ${i.name}`} />
            )}
          </td>
        )}
        <td className="insp-name">
          {i.name}
          {i.inactive && <span className="insp-tag">INACTIVE</span>}
          {hasReminder && !unset && <span className="insp-bell" title="Reminder set"><Icon name="bell" size={11} /></span>}
        </td>
        <td className="insp-due">
          {unset ? <span className="dash">—</span> : (
            <span className="due-wrap">
              <i className={`due-bar ${cls}`} />
              <span className="due-text">{dueInShort(i, st)}</span>
            </span>
          )}
        </td>
        <td className="insp-last">
          {unset ? <span className="dash">—</span> : (
            <>
              <div>{fmtDate(i.lastDate)}</div>
              {i.lastHobbs != null && <div className="sub">{i.lastHobbs.toFixed(1)} HRS</div>}
            </>
          )}
        </td>
        <td className="insp-next">{unset ? <span className="dash">—</span> : nextService(i, st)}</td>
        <td className="insp-int">{intervalShort(i)}</td>
        <td className="insp-by">{unset ? <span className="dash">—</span> : (i.by || <span className="dash">—</span>)}</td>
        <td className="insp-on">{unset ? <span className="dash">—</span> : fmtDate(i.updatedOn)}</td>
        <td className="insp-actions">
          {canEdit && (
            <div className="action-cell even">
              {unset
                ? <button className="pill activate" onClick={() => setActivate(idx)}>Activate</button>
                : <button className="pill" onClick={() => openUpdate(idx)}>Update</button>}
              {menu.length ? <RowMenu items={menu} label={i.name} /> : <span className="menu-slot" aria-hidden="true" />}
            </div>
          )}
        </td>
      </tr>
    );
  }

  const head = (label: string) => (
    <thead>
      <tr>
        {mode && <th className="insp-check" />}
        <th className="c-name">{label}</th><th className="c-due">Due In</th>
        <th className="c-last">Last Serviced</th><th className="c-next">Next Service</th>
        <th className="c-int">Interval</th><th className="c-by">Updated By</th>
        <th className="c-on">Updated On</th><th className="c-act">Actions</th>
      </tr>
    </thead>
  );

  const table = (label: string, list: typeof rows) => (
    <div className="table-scroll insp-scroll">
      <table className="data-table insp-table">
        {head(label)}
        <tbody>
          {list.length === 0
            ? <tr><td colSpan={mode ? 9 : 8} className="insp-empty">Nothing here{view !== "all" ? " for this filter" : ""}.</td></tr>
            : list.map(renderRow)}
        </tbody>
      </table>
    </div>
  );

  const groupsOut = groups
    ? [
        ["Airworthiness Items", rows.filter((r) => r.i.group !== "general")],
        ["General Items", rows.filter((r) => r.i.group === "general")],
      ] as const
    : ([["Inspection Type", rows]] as const);

  return (
    <>
      <div className="insp-toolbar">
        {canEdit && !mode && (
          <div className="bulk">
            <span className="bulk-lbl"><Icon name="info" size={12} /> Bulk actions</span>
            <button className="bulk-btn" disabled={busy} onClick={() => enterMode("activate")}>Activate</button>
            <button className="bulk-btn" disabled={busy} onClick={() => enterMode("update")}>Update</button>
            <button className="bulk-btn" disabled={busy} onClick={() => enterMode("deactivate")}>Deactivate</button>
          </div>
        )}
        {canEdit && mode && (
          <div className="bulk on">
            <span className="bulk-lbl">
              {mode === "activate" ? "Activate" : mode === "update" ? "Update" : "Deactivate"} · select rows
            </span>
            <span className="bulk-count">{sel.length} selected</span>
            <button className="btn sm primary" disabled={!sel.length || busy} onClick={() => setBulk(mode)}>Apply</button>
            <button className="btn sm" onClick={leaveMode}>Cancel</button>
          </div>
        )}
        <div className="insp-tools">
          <button className={`btn sm${view !== "all" || sort !== "default" ? " on" : ""}`} onClick={() => setFilterOpen(true)}>
            <Icon name="filter" size={13} /> Filters
          </button>
          {canEdit && (
            <button className="btn sm primary" onClick={() => { setForm(blank(presets, maintHrs)); setAdd(true); }}>{addLabel}</button>
          )}
        </div>
      </div>

      {groupsOut.map(([label, list]) => (
        <div key={label} className="insp-group">
          {groups && <div className="insp-group-hd">{label}</div>}
          {table(label, list)}
        </div>
      ))}

      {filterOpen && (
        <Modal title="Filter & Sort" onClose={() => setFilterOpen(false)}>
          <div className="form-row">
            <label>View</label>
            <select value={view} onChange={(e) => setView(e.target.value as View)}>
              <option value="all">View all</option>
              <option value="hours">Next service by flight hours</option>
              <option value="date">Next service by due date</option>
            </select>
          </div>
          <div className="form-row">
            <label>Sort</label>
            <div className="radio-list">
              {([["default", "Default order"], ["az", "A – Z"], ["za", "Z – A"]] as const).map(([v, l]) => (
                <label key={v} className="radio-row">
                  <span>{l}</span>
                  <input type="radio" name="sort" checked={sort === v} onChange={() => setSort(v)} />
                </label>
              ))}
            </div>
          </div>
          <div className="form-actions">
            <button className="btn-cancel" onClick={() => { setView("all"); setSort("default"); }}>Clear all</button>
            <button className="btn-save" onClick={() => setFilterOpen(false)}>Apply</button>
          </div>
        </Modal>
      )}

      {update != null && (
        <Modal title="Last Serviced" onClose={() => setUpdate(null)}>
          <p className="modal-sub">Enter the hours and date the <b>{items[update].name}</b> was completed.</p>
          <div className="form-grid">
            <div className="form-row">
              <label>Hours at Completion</label>
              <input type="number" step="0.1" value={hours} onChange={(e) => setHours(e.target.value)} placeholder={maintHrs > 0 ? maintHrs.toFixed(1) : ""} />
            </div>
            <div className="form-row">
              <label>Date of Completion</label>
              <input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
            </div>
          </div>
          <div className="form-row">
            <label>Performed By</label>
            <input value={by} onChange={(e) => setBy(e.target.value)} placeholder="Name or shop…" />
          </div>
          <div className="form-actions">
            <button className="btn-cancel" onClick={() => setUpdate(null)}>Cancel</button>
            <button className="btn-save" onClick={doUpdate} disabled={busy}>{busy ? "Saving…" : "Finish update"}</button>
          </div>
        </Modal>
      )}

      {edit != null && (
        <Modal title={`Edit ${noun}`} onClose={() => setEdit(null)}>
          <p className="modal-sub">Editing <b>{items[edit].name}</b>.</p>
          {!items[edit].core && (
            <>
              <div className="form-row">
                <label>Name</label>
                <input value={form.custom} onChange={(e) => setForm((f) => ({ ...f, custom: e.target.value }))} />
              </div>
              <IntervalFields form={form} setForm={setForm} />
            </>
          )}
          <div className="mono modal-kicker">Last serviced</div>
          <div className="form-grid">
            <div className="form-row">
              <label>Hours at Completion</label>
              <input type="number" step="0.1" value={hours} onChange={(e) => setHours(e.target.value)} />
            </div>
            <div className="form-row">
              <label>Date of Completion</label>
              <input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
            </div>
          </div>
          <div className="form-row">
            <label>Performed By</label>
            <input value={by} onChange={(e) => setBy(e.target.value)} placeholder="Name or shop…" />
          </div>
          <div className="form-actions">
            <button className="btn-cancel" onClick={() => setEdit(null)}>Cancel</button>
            <button className="btn-save" onClick={doEdit} disabled={busy}>{busy ? "Saving…" : "Save"}</button>
          </div>
        </Modal>
      )}

      {reminder != null && (
        <Modal title="Set Reminder" onClose={() => setReminder(null)}>
          <p className="modal-sub">
            Next service for <b>{items[reminder].name}</b>: <b>{nextService(items[reminder], ic(items[reminder], maintHrs))}</b>.
            The row turns <b>due soon</b> once the reminder is reached.
          </p>
          {items[reminder].intervalHrs ? (
            <div className="form-row">
              <label>Remind at flight hours</label>
              <input type="number" step="0.1" value={remHrs} onChange={(e) => setRemHrs(e.target.value)} />
            </div>
          ) : null}
          {items[reminder].intervalDays ? (
            <div className="form-row">
              <label>Remind on date</label>
              <input type="date" value={remDate} onChange={(e) => setRemDate(e.target.value)} />
            </div>
          ) : null}
          <div className="form-actions">
            {(items[reminder].reminderHrs != null || items[reminder].reminderDate) && (
              <button className="btn-cancel" onClick={() => clearReminder(reminder)}>Clear</button>
            )}
            <button className="btn-cancel" onClick={() => setReminder(null)}>Cancel</button>
            <button className="btn-save" onClick={doReminder} disabled={busy}>Save reminder</button>
          </div>
        </Modal>
      )}

      {activate != null && (
        <Modal title={items[activate].name} onClose={() => setActivate(null)}>
          <p className="modal-sub">Has the <b>{items[activate].name}</b> been completed on this aircraft before?</p>
          <div className="form-actions">
            <button className="btn-cancel" onClick={() => activateNow(activate)} disabled={busy}>No — start today</button>
            <button className="btn-save" onClick={() => { const idx = activate; setActivate(null); openUpdate(idx); }}>Yes — enter it</button>
          </div>
        </Modal>
      )}

      {deactivate != null && (
        <Confirm
          title={`Deactivate ${noun}`}
          message={<>Stop tracking <b>{items[deactivate].name}</b>? It stays in the table as inactive and no longer counts towards status. Nothing recorded is deleted; Activate brings it back.</>}
          confirmLabel="Deactivate"
          danger={false}
          onConfirm={() => doDeactivate(deactivate)}
          onCancel={() => setDeactivate(null)}
        />
      )}

      {remove != null && (
        <Confirm
          title="Delete row"
          message={<>Remove <b>{items[remove].name}</b> from this aircraft entirely?</>}
          confirmLabel="Delete row"
          onConfirm={() => doRemove(remove)}
          onCancel={() => setRemove(null)}
        />
      )}

      {bulk && (
        <Confirm
          title={bulk === "activate" ? "Activate selected" : bulk === "update" ? "Update selected" : "Deactivate selected"}
          message={
            bulk === "activate"
              ? <>Start the clock today at <b>{maintHrs.toFixed(1)} hrs</b> for {selUnset.length} {selUnset.length === 1 ? noun : noun + "s"}: <b>{selUnset.map((k) => items[k].name).join(", ")}</b>.</>
              : bulk === "update"
                ? <>Record {selLive.length} {selLive.length === 1 ? noun : noun + "s"} as completed today at <b>{maintHrs.toFixed(1)} hrs</b>: <b>{selLive.map((k) => items[k].name).join(", ")}</b>.</>
                : <>Deactivate {selLive.length} {selLive.length === 1 ? noun : noun + "s"}: <b>{selLive.map((k) => items[k].name).join(", ")}</b>. Nothing recorded is deleted.</>
          }
          confirmLabel={bulk === "activate" ? "Activate" : bulk === "update" ? "Update" : "Deactivate"}
          danger={false}
          onConfirm={doBulk}
          onCancel={() => setBulk(null)}
        />
      )}

      {add && (
        <Modal title={addLabel} onClose={() => setAdd(false)}>
          <div className="form-row">
            <label>Type</label>
            <select value={form.type} onChange={(e) => setForm((f) => ({ ...f, type: e.target.value }))}>
              {presets.map((c) => <option key={c.name}>{c.name}</option>)}
              <option>Custom...</option>
            </select>
          </div>
          {isCustom && (
            <div className="form-row">
              <label>Name</label>
              <input value={form.custom} onChange={(e) => setForm((f) => ({ ...f, custom: e.target.value }))} placeholder="Prop overhaul" />
            </div>
          )}
          {preset ? (
            <div className="how-box" style={{ marginBottom: 12 }}>
              <span className="mono" style={{ display: "block", marginBottom: 3 }}>INTERVAL</span>
              <b>{intervalShort(preset)}</b>
            </div>
          ) : <IntervalFields form={form} setForm={setForm} />}
          <div className="form-grid">
            <div className="form-row">
              <label>Date Completed</label>
              <input type="date" value={form.date} onChange={(e) => setForm((f) => ({ ...f, date: e.target.value }))} />
            </div>
            <div className="form-row">
              <label>Hours at Completion</label>
              <input type="number" step="0.1" value={form.hobbs} onChange={(e) => setForm((f) => ({ ...f, hobbs: e.target.value }))} placeholder={maintHrs > 0 ? maintHrs.toFixed(1) : ""} />
            </div>
          </div>
          <div className="form-row">
            <label>Performed By</label>
            <input value={form.by} onChange={(e) => setForm((f) => ({ ...f, by: e.target.value }))} placeholder="Name or shop…" />
          </div>
          <div className="form-actions">
            <button className="btn-cancel" onClick={() => setAdd(false)}>Cancel</button>
            <button className="btn-save" onClick={doAdd} disabled={busy}>{busy ? "Saving…" : "Save"}</button>
          </div>
        </Modal>
      )}
    </>
  );
}

/** "185.8 HRS" or "Jun 30, 2027": the binding next-service figure. */
function nextService(i: Insp, st: ReturnType<typeof ic>): string {
  if (st.s === "none") return "—";
  if (st.s === "unknown") return st.nl;
  const hrs = i.intervalHrs && i.lastHobbs != null ? `${(i.lastHobbs + i.intervalHrs).toFixed(1)} HRS` : null;
  const date = i.intervalDays && st.due && /^\d{4}-\d{2}-\d{2}$/.test(st.due) ? fmtDate(st.due) : null;
  if (hrs && date) {
    const hrsShare = st.remHrs != null && i.intervalHrs ? st.remHrs / i.intervalHrs : Infinity;
    const daysShare = st.remDays != null && i.intervalDays ? st.remDays / i.intervalDays : Infinity;
    return hrsShare <= daysShare ? hrs : date;
  }
  return hrs ?? date ?? "—";
}

function blank(presets: Insp[], hrs: number): FormState {
  return {
    type: presets[0]?.name ?? "Custom...", custom: "", intType: "days", intHrs: "", intDays: "",
    date: today(), hobbs: hrs > 0 ? hrs.toFixed(1) : "", by: "",
  };
}

function IntervalFields({ form, setForm }: { form: FormState; setForm: React.Dispatch<React.SetStateAction<FormState>> }) {
  return (
    <div className="form-grid">
      <div className="form-row">
        <label>Interval Type</label>
        <select value={form.intType} onChange={(e) => setForm((f) => ({ ...f, intType: e.target.value as FormState["intType"] }))}>
          <option value="days">Calendar</option>
          <option value="hours">Hours</option>
          <option value="both">Hours or calendar, whichever first</option>
        </select>
      </div>
      {form.intType !== "days" && (
        <div className="form-row">
          <label>Hours</label>
          <input type="number" value={form.intHrs} onChange={(e) => setForm((f) => ({ ...f, intHrs: e.target.value }))} placeholder="100" />
        </div>
      )}
      {form.intType !== "hours" && (
        <div className="form-row">
          <label>Days</label>
          <input type="number" value={form.intDays} onChange={(e) => setForm((f) => ({ ...f, intDays: e.target.value }))} placeholder="365" />
        </div>
      )}
    </div>
  );
}
