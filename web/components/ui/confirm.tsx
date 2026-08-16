"use client";

import { Modal } from "./modal";

// Replaces v1's confirmDel()/promptDeleteSq()/promptDeleteAircraft() dialogs.
// The first port deleted documents with no confirmation at all.
export function Confirm({
  title = "Are you sure?",
  message,
  confirmLabel = "Delete",
  danger = true,
  busy,
  onConfirm,
  onCancel,
}: {
  title?: string;
  message: React.ReactNode;
  confirmLabel?: string;
  danger?: boolean;
  busy?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  return (
    <Modal title={title} onClose={onCancel}>
      <div style={{ fontSize: 13, color: "var(--muted3)", lineHeight: 1.7 }}>{message}</div>
      <div className="form-actions">
        <button className="btn-cancel" onClick={onCancel}>Cancel</button>
        <button
          className={danger ? "btn-del" : "btn-save"}
          onClick={onConfirm}
          disabled={busy}
        >
          {busy ? "Working…" : confirmLabel}
        </button>
      </div>
    </Modal>
  );
}
