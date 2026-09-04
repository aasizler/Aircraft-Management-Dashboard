"use client";

import { useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { newId, today, type DocEntry } from "@/lib/aircraft";
import type { TabProps } from "../detail-client";
import { Confirm } from "@/components/ui/confirm";
import { useToast } from "@/components/ui/toast";
import { Publications } from "@/components/aircraft/publications";
import { EmptyState } from "@/components/ui/empty-state";

const MAX_MB = 25;

export function DocumentsTab({ aircraft, data, save, allow }: TabProps) {
  const docs = (data.documents ?? []) as DocEntry[];
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [drag, setDrag] = useState(false);
  const [confirmDoc, setConfirmDoc] = useState<DocEntry | null>(null);
  const toast = useToast();

  async function upload(file: File) {
    if (file.size > MAX_MB * 1024 * 1024) {
      toast(`${file.name} is over ${MAX_MB}MB.`, "warn");
      return;
    }
    // iPhone uploads arrive as HEIC, which browsers can't display. v1 converted
    // via heic2any; flag it rather than storing a file nobody can open.
    const isHeic = /\.hei[cf]$/i.test(file.name) || /hei[cf]/i.test(file.type);

    setBusy(true);
    const supabase = createClient();
    const path = `${aircraft.id}/${newId("doc")}_${file.name}`;
    const { error } = await supabase.storage
      .from("documents")
      .upload(path, file, { upsert: false, contentType: file.type || undefined });
    if (error) {
      toast(`Upload failed: ${error.message}`, "danger");
      setBusy(false);
      return;
    }
    const entry: DocEntry = {
      name: file.name,
      size: file.size,
      uploadedOn: today(),
      storagePath: path,
    };
    await save({ ...data, documents: [entry, ...docs] });
    setBusy(false);
    toast(
      isHeic
        ? `${file.name} uploaded — HEIC may not preview in-browser`
        : `${file.name} uploaded`,
      isHeic ? "warn" : "ok",
    );
  }

  async function view(d: DocEntry) {
    const { data: signed, error } = await createClient()
      .storage.from("documents")
      .createSignedUrl(d.storagePath, 3600);
    if (error || !signed?.signedUrl) {
      toast("Could not open document.", "danger");
      return;
    }
    window.open(signed.signedUrl, "_blank");
  }

  async function remove(d: DocEntry) {
    setBusy(true);
    const { error } = await createClient().storage.from("documents").remove([d.storagePath]);
    if (error) {
      toast(`Delete failed: ${error.message}`, "danger");
      setBusy(false);
      return;
    }
    await save({ ...data, documents: docs.filter((x) => x.storagePath !== d.storagePath) });
    setBusy(false);
    setConfirmDoc(null);
    toast("Document deleted", "ok");
  }

  return (
    <div style={{ paddingTop: 16 }}>
      <div style={{ marginBottom: 16 }}>
        <div className="section-label" style={{ marginBottom: 4 }}>Logbooks and Documents</div>
        <div style={{ fontSize: 11, color: "var(--muted)" }}>
          Upload PDFs — logbooks, annual paperwork, 337s, STCs, maintenance records.
          Documents are stored securely in the cloud.
        </div>
      </div>

      {allow("upload_doc") && (
      <div
        className={`pdf-drop ${drag ? "drag" : ""}`}
        onClick={() => inputRef.current?.click()}
        onDragOver={(e) => { e.preventDefault(); setDrag(true); }}
        onDragLeave={() => setDrag(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDrag(false);
          if (e.dataTransfer.files[0]) upload(e.dataTransfer.files[0]);
        }}
      >
        <div className="pdf-drop-icon">＋</div>
        <div className="pdf-drop-title">{busy ? "Working…" : "Drop file here or click to browse"}</div>
        <div className="pdf-drop-sub">PDF, JPG, PNG, HEIC — logbooks, maintenance records, STCs, photos</div>
        <input
          ref={inputRef}
          type="file"
          accept=".pdf,image/*,.heic,.HEIC"
          style={{ display: "none" }}
          onChange={(e) => e.target.files?.[0] && upload(e.target.files[0])}
        />
      </div>
      )}

      <ul className="doc-list">
        {docs.length === 0 ? (
          <li>
            <EmptyState
              icon="file"
              title="No documents yet"
              body="Logbooks, annual paperwork, 337s and STCs live here — drop a file above to add the first."
            />
          </li>
        ) : (
          docs.map((d, idx) => (
            <li className="doc-item" key={idx}>
              <span className="doc-pdf-icon">
                {d.name.split(".").pop()?.slice(0, 3).toUpperCase() ?? "DOC"}
              </span>
              <div style={{ flex: 1, minWidth: 0, cursor: "pointer" }} onClick={() => view(d)}>
                <div className="doc-name">{d.name}</div>
                <div className="doc-meta">
                  {d.uploadedOn ?? ""}
                  {d.size ? ` · ${Math.round(d.size / 1024)} KB` : ""}
                </div>
              </div>
              {allow("upload_doc") && (
                <button className="action-btn del" onClick={() => setConfirmDoc(d)} disabled={busy}>
                  Delete
                </button>
              )}
            </li>
          ))
        )}
      </ul>

      {confirmDoc && (
        <Confirm
          title="Delete document"
          message={<>Permanently delete <b>{confirmDoc.name}</b> from storage? This cannot be undone.</>}
          busy={busy}
          onConfirm={() => remove(confirmDoc)}
          onCancel={() => setConfirmDoc(null)}
        />
      )}

      <Publications
        reg={aircraft.reg}
        type={aircraft.type}
        engineType={(data.engineType as string | null) ?? null}
      />
    </div>
  );
}
