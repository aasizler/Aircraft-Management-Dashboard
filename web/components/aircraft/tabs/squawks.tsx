"use client";

import { useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import {
  newId, SQ_BADGE, SQ_COLORS, SQ_LABELS, today,
  type ArchivedSquawk, type Squawk, type SquawkStatus,
} from "@/lib/aircraft";
import type { TabProps } from "../detail-client";
import { Modal } from "@/components/ui/modal";
import { Confirm } from "@/components/ui/confirm";
import { RowMenu } from "@/components/ui/row-menu";
import { useToast } from "@/components/ui/toast";

const STATUSES: SquawkStatus[] = ["open", "progress", "watch"];

/**
 * The Squawks tab, restored. v1 had a full tab here (renderSq, openSquawkModal,
 * editSq, saveSquawk, openArchiveModal, confirmArchiveSq, restoreSq,
 * promptDeleteSq, promptDeleteArchivedSq, viewArchiveDoc, toggleSquawkArchive);
 * the first port dropped all of it.
 *
 * Sign-off attachments go to Supabase Storage under the aircraft's folder,
 * replacing v1's localStorage base64 blobs (which blew the 5MB quota).
 */
export function SquawksTab({ aircraft, data, save, consumeAction, allow }: TabProps) {
  const squawks = (data.squawks ?? []) as Squawk[];
  const archive = (data.squawkArchive ?? []) as ArchivedSquawk[];
  const toast = useToast();

  // Opens straight into "Add Squawk" when routed from the dashboard.
  const [modal, setModal] = useState<null | { mode: "add" | "edit"; id?: string }>(
    () => (consumeAction("add-squawk") ? { mode: "add" } : null),
  );
  const [form, setForm] = useState<{ desc: string; status: SquawkStatus; date: string }>({
    desc: "", status: "open", date: today(),
  });
  const [busy, setBusy] = useState(false);
  const [showArchive, setShowArchive] = useState(false);
  const [archiving, setArchiving] = useState<Squawk | null>(null);
  const [archForm, setArchForm] = useState({ by: "", date: today(), notes: "" });
  const [archFile, setArchFile] = useState<File | null>(null);
  const [confirmSq, setConfirmSq] = useState<{ kind: "active" | "archived"; idx: number } | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  function openAdd() {
    setForm({ desc: "", status: "open", date: today() });
    setModal({ mode: "add" });
  }

  function openEdit(sq: Squawk) {
    setForm({ desc: sq.desc, status: sq.status, date: sq.date });
    setModal({ mode: "edit", id: sq.id });
  }

  async function submit() {
    if (!form.desc.trim()) { toast("Describe the squawk.", "warn"); return; }
    setBusy(true);
    const next =
      modal?.mode === "edit"
        ? squawks.map((s) => (s.id === modal.id ? { ...s, ...form, desc: form.desc.trim() } : s))
        : [{ id: newId("sq"), desc: form.desc.trim(), status: form.status, date: form.date }, ...squawks];
    await save({ ...data, squawks: next });
    setBusy(false);
    setModal(null);
    toast(modal?.mode === "edit" ? "Squawk updated" : "Squawk added", "ok");
  }

  function startArchive(sq: Squawk) {
    setArchiving(sq);
    setArchForm({ by: "", date: today(), notes: "" });
    setArchFile(null);
  }

  async function confirmArchive() {
    if (!archiving) return;
    setBusy(true);
    let attachment: ArchivedSquawk["attachment"] = null;

    if (archFile) {
      const path = `${aircraft.id}/squawks/${newId("sq")}_${archFile.name}`;
      const { error } = await createClient()
        .storage.from("documents")
        .upload(path, archFile, { upsert: false });
      if (error) {
        toast(`Attachment upload failed: ${error.message}`, "danger");
        setBusy(false);
        return;
      }
      attachment = { name: archFile.name, size: archFile.size, storagePath: path };
    }

    const entry: ArchivedSquawk = {
      ...archiving,
      archivedOn: today(),
      resolvedBy: archForm.by.trim() || null,
      resolvedDate: archForm.date || null,
      resolutionNotes: archForm.notes.trim() || null,
      attachment,
    };
    await save({
      ...data,
      squawks: squawks.filter((s) => s.id !== archiving.id),
      squawkArchive: [entry, ...archive],
    });
    setBusy(false);
    setArchiving(null);
    toast("Squawk archived", "ok");
  }

  async function restore(idx: number) {
    const sq = archive[idx];
    const { archivedOn, resolvedBy, resolvedDate, resolutionNotes, attachment, ...rest } = sq;
    void archivedOn; void resolvedBy; void resolvedDate; void resolutionNotes; void attachment;
    await save({
      ...data,
      squawks: [rest as Squawk, ...squawks],
      squawkArchive: archive.filter((_, k) => k !== idx),
    });
    toast("Squawk restored to active", "ok");
  }

  async function doDelete() {
    if (!confirmSq) return;
    if (confirmSq.kind === "active") {
      await save({ ...data, squawks: squawks.filter((_, k) => k !== confirmSq.idx) });
    } else {
      await save({ ...data, squawkArchive: archive.filter((_, k) => k !== confirmSq.idx) });
    }
    setConfirmSq(null);
    toast("Squawk deleted", "ok");
  }

  async function viewDoc(a: NonNullable<ArchivedSquawk["attachment"]>) {
    if (!a.storagePath) { toast("No stored document for this squawk.", "warn"); return; }
    const { data: signed } = await createClient()
      .storage.from("documents")
      .createSignedUrl(a.storagePath, 3600);
    if (signed?.signedUrl) window.open(signed.signedUrl, "_blank");
    else toast("Could not open document.", "danger");
  }

  return (
    <>
      <div className="tbl-toolbar">
        {allow("squawk") && (
          <button className="btn sm primary" onClick={openAdd}>Add Squawk</button>
        )}
      </div>

      <div className="table-scroll">
        <table className="data-table">
          <thead>
            <tr>
              <th style={{ width: 24 }}></th>
              <th>Description</th>
              <th>Status</th>
              <th>Date</th>
              <th style={{ width: 150 }}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {squawks.length === 0 ? (
              <tr>
                <td colSpan={5} style={{ color: "var(--muted2)" }}>
                  No active squawks on record.
                </td>
              </tr>
            ) : (
              squawks.map((sq, idx) => (
                <tr key={sq.id}>
                  <td><span className="sq-dot" style={{ background: SQ_COLORS[sq.status] }} /></td>
                  <td className="wrap-cell" style={{ fontSize: 12.5 }}>{sq.desc}</td>
                  <td><span className={`badge ${SQ_BADGE[sq.status]}`}>{SQ_LABELS[sq.status]}</span></td>
                  <td className="mono">{sq.date}</td>
                  <td>
                    <div className="action-cell">
                      <button className="action-btn" onClick={() => startArchive(sq)}>Archive</button>
                      <RowMenu
                        items={[
                          { label: "Edit", onClick: () => openEdit(sq) },
                          { label: "Delete", onClick: () => setConfirmSq({ kind: "active", idx }), danger: true },
                        ]}
                      />
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {archive.length > 0 && (
        <>
          <div className="archive-hd" onClick={() => setShowArchive((s) => !s)}>
            <span className="archive-hd-lbl">Archive</span>
            <span className="archive-hd-rule" />
            <span className="archive-hd-tog">{showArchive ? "▼ hide" : "▶ show"}</span>
          </div>
          {showArchive && (
            <div className="table-scroll" style={{ opacity: 0.85 }}>
              <table className="data-table">
                <thead>
                  <tr>
                    <th style={{ width: 24 }}></th>
                    <th>Description</th><th>Status</th><th>Noted</th>
                    <th>Resolved</th><th>By</th><th>Notes / Docs</th><th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {archive.map((sq, idx) => (
                    <tr key={sq.id + idx}>
                      <td><span className="sq-dot" style={{ background: SQ_COLORS[sq.status] }} /></td>
                      <td className="wrap-cell" style={{ fontSize: 12.5 }}>{sq.desc}</td>
                      <td><span className={`badge ${SQ_BADGE[sq.status]}`}>{SQ_LABELS[sq.status]}</span></td>
                      <td className="mono">{sq.date}</td>
                      <td className="mono">{sq.resolvedDate || sq.archivedOn || "—"}</td>
                      <td style={{ fontSize: 12, color: "var(--muted2)" }}>{sq.resolvedBy || "—"}</td>
                      <td className="wrap-cell" style={{ fontSize: 11, color: "var(--muted2)" }}>
                        {sq.resolutionNotes && <span style={{ display: "block", marginBottom: 3 }}>{sq.resolutionNotes}</span>}
                        {sq.attachment?.name && (
                          <>
                            <span style={{ color: "var(--accent)", fontFamily: "var(--mono)", fontSize: 10 }}>
                              📎 {sq.attachment.name}
                            </span>{" "}
                            <button
                              className="action-btn"
                              style={{ padding: "3px 8px", fontSize: 10 }}
                              onClick={() => viewDoc(sq.attachment!)}
                            >
                              View
                            </button>
                          </>
                        )}
                      </td>
                      <td>
                        <div className="action-cell">
                          <button className="action-btn" onClick={() => restore(idx)}>Restore</button>
                          <button className="action-btn del" onClick={() => setConfirmSq({ kind: "archived", idx })}>
                            Delete
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}

      {modal && (
        <Modal title={modal.mode === "edit" ? "Edit Squawk" : "Add Squawk"} onClose={() => setModal(null)}>
          <div className="form-row">
            <label>Description</label>
            <textarea
              rows={3}
              value={form.desc}
              onChange={(e) => setForm((f) => ({ ...f, desc: e.target.value }))}
              placeholder="Describe the issue…"
            />
          </div>
          <div className="form-grid">
            <div className="form-row">
              <label>Status</label>
              <select
                value={form.status}
                onChange={(e) => setForm((f) => ({ ...f, status: e.target.value as SquawkStatus }))}
              >
                {STATUSES.map((s) => <option key={s} value={s}>{SQ_LABELS[s]}</option>)}
              </select>
            </div>
            <div className="form-row">
              <label>Date Noted</label>
              <input type="date" value={form.date} onChange={(e) => setForm((f) => ({ ...f, date: e.target.value }))} />
            </div>
          </div>
          <div className="form-actions">
            <button className="btn-cancel" onClick={() => setModal(null)}>Cancel</button>
            <button className="btn-save" onClick={submit} disabled={busy}>
              {busy ? "Saving…" : "Save"}
            </button>
          </div>
        </Modal>
      )}

      {archiving && (
        <Modal title="Archive Squawk" onClose={() => setArchiving(null)}>
          <div className="how-box">{archiving.desc}</div>
          <div className="form-row">
            <label>Resolution Notes</label>
            <textarea
              rows={3}
              value={archForm.notes}
              onChange={(e) => setArchForm((f) => ({ ...f, notes: e.target.value }))}
              placeholder="Describe how this was resolved, parts used, shop that performed the work..."
            />
          </div>
          <div className="form-grid">
            <div className="form-row">
              <label>Resolved By</label>
              <input value={archForm.by} onChange={(e) => setArchForm((f) => ({ ...f, by: e.target.value }))} placeholder="Mechanic name, shop, or owner" />
            </div>
            <div className="form-row">
              <label>Date Resolved</label>
              <input type="date" value={archForm.date} onChange={(e) => setArchForm((f) => ({ ...f, date: e.target.value }))} />
            </div>
          </div>
          <div className="form-row">
            <label>Sign-off Document</label>
            <button className="btn sm" onClick={() => fileRef.current?.click()}>
              {archFile ? `Attached: ${archFile.name}` : "Attach PDF / photo"}
            </button>
            <input
              ref={fileRef}
              type="file"
              accept=".pdf,image/*"
              style={{ display: "none" }}
              onChange={(e) => setArchFile(e.target.files?.[0] ?? null)}
            />
          </div>
          <div className="form-actions">
            <button className="btn-cancel" onClick={() => setArchiving(null)}>Cancel</button>
            <button className="btn-save" onClick={confirmArchive} disabled={busy}>
              {busy ? "Archiving…" : "Archive Squawk"}
            </button>
          </div>
        </Modal>
      )}

      {confirmSq && (
        <Confirm
          title="Delete squawk"
          message={
            <>
              Delete “
              <b>
                {(confirmSq.kind === "active" ? squawks[confirmSq.idx] : archive[confirmSq.idx])?.desc.slice(0, 70)}
              </b>
              ”? This cannot be undone.
            </>
          }
          onConfirm={doDelete}
          onCancel={() => setConfirmSq(null)}
        />
      )}
    </>
  );
}
