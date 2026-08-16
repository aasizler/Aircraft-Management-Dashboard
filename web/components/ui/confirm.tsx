"use client";

import { useEffect, useRef, useState } from "react";
import { Modal } from "./modal";

// Replaces v1's confirmDel()/promptDeleteSq()/promptDeleteAircraft() dialogs.
// The first port deleted documents with no confirmation at all.
export function Confirm({
  title = "Are you sure?",
  message,
  confirmLabel = "Delete",
  danger = true,
  busy,
  requireText,
  onConfirm,
  onCancel,
}: {
  title?: string;
  message: React.ReactNode;
  confirmLabel?: string;
  danger?: boolean;
  busy?: boolean;
  /**
   * When set, the action stays disabled until the user types this exactly
   * (case-insensitive). v1's promptDeleteAircraft() demanded the tail number
   * before it would delete an aircraft — a plain OK button is too easy to hit
   * by reflex for something with no undo.
   */
  requireText?: string;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  const [typed, setTyped] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  // v1 focused the field on open so confirming is one uninterrupted motion.
  useEffect(() => {
    if (requireText) inputRef.current?.focus();
  }, [requireText]);

  const matched =
    !requireText || typed.trim().toUpperCase() === requireText.toUpperCase();
  const blocked = busy || !matched;

  return (
    <Modal title={title} onClose={onCancel}>
      <div style={{ fontSize: 13, color: "var(--muted3)", lineHeight: 1.7 }}>{message}</div>

      {requireText && (
        <>
          <div className="confirm-type-lbl">
            Type <b>{requireText}</b> to confirm
          </div>
          <input
            ref={inputRef}
            className="confirm-type-input"
            type="text"
            value={typed}
            placeholder={requireText}
            autoComplete="off"
            spellCheck={false}
            onChange={(e) => setTyped(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !blocked) onConfirm();
            }}
          />
        </>
      )}

      <div className="form-actions">
        <button className="btn-cancel" onClick={onCancel}>Cancel</button>
        <button
          className={danger ? "btn-del" : "btn-save"}
          onClick={onConfirm}
          disabled={blocked}
          style={blocked ? { opacity: 0.35 } : undefined}
        >
          {busy ? "Working…" : confirmLabel}
        </button>
      </div>
    </Modal>
  );
}
