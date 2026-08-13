"use client";

import { useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import type { TabProps } from "../detail-client";

type Doc = { name: string; size?: number; uploadedOn?: string; storagePath: string };

export function DocumentsTab({ aircraft, data, save }: TabProps) {
  const docs = (data.documents as Doc[]) ?? [];
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [drag, setDrag] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function upload(file: File) {
    setBusy(true);
    setErr(null);
    const supabase = createClient();
    const path = `${aircraft.id}/${Date.now()}_${file.name}`;
    const { error } = await supabase.storage
      .from("documents")
      .upload(path, file, { upsert: false });
    if (error) {
      setErr(error.message);
      setBusy(false);
      return;
    }
    const entry: Doc = {
      name: file.name,
      size: file.size,
      uploadedOn: new Date().toISOString().slice(0, 10),
      storagePath: path,
    };
    await save({ ...data, documents: [entry, ...docs] });
    setBusy(false);
  }

  async function view(d: Doc) {
    const supabase = createClient();
    const { data: signed } = await supabase.storage
      .from("documents")
      .createSignedUrl(d.storagePath, 3600);
    if (signed?.signedUrl) window.open(signed.signedUrl, "_blank");
  }

  async function remove(d: Doc) {
    setBusy(true);
    const supabase = createClient();
    await supabase.storage.from("documents").remove([d.storagePath]);
    await save({ ...data, documents: docs.filter((x) => x.storagePath !== d.storagePath) });
    setBusy(false);
  }

  return (
    <div style={{ paddingTop: 18 }}>
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
        <div className="pdf-drop-icon">⬆</div>
        <div className="pdf-drop-title">{busy ? "Uploading…" : "Upload a document"}</div>
        <div className="pdf-drop-sub">Drag &amp; drop or click to browse</div>
        <input
          ref={inputRef}
          type="file"
          style={{ display: "none" }}
          onChange={(e) => e.target.files?.[0] && upload(e.target.files[0])}
        />
      </div>

      {err && <div className="auth-err">{err}</div>}

      <ul className="doc-list">
        {docs.length === 0 ? (
          <li className="doc-item" style={{ color: "var(--muted2)" }}>
            No documents.
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
              <button className="action-btn del" onClick={() => remove(d)} disabled={busy}>
                Delete
              </button>
            </li>
          ))
        )}
      </ul>
    </div>
  );
}
