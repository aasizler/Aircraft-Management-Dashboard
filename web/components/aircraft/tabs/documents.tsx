import type { TabProps } from "../detail-client";

type Doc = { name?: string; size?: number; uploadedOn?: string; storagePath?: string };

export function DocumentsTab({ data }: TabProps) {
  const docs = (data.documents as Doc[]) ?? [];

  return (
    <div style={{ paddingTop: 18 }}>
      <div className="pdf-drop">
        <div className="pdf-drop-icon">⬆</div>
        <div className="pdf-drop-title">Upload a document</div>
        <div className="pdf-drop-sub">
          Drag &amp; drop or click — wiring to Supabase Storage next
        </div>
      </div>

      <ul className="doc-list">
        {docs.length === 0 ? (
          <li className="doc-item" style={{ color: "var(--muted2)" }}>
            No documents.
          </li>
        ) : (
          docs.map((d, idx) => (
            <li className="doc-item" key={idx}>
              <span className="doc-pdf-icon">PDF</span>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div className="doc-name">{d.name ?? "Document"}</div>
                <div className="doc-meta">
                  {d.uploadedOn ?? ""}
                  {d.size ? ` · ${Math.round(d.size / 1024)} KB` : ""}
                </div>
              </div>
              <span className="cloud-dot">synced</span>
            </li>
          ))
        )}
      </ul>
    </div>
  );
}
