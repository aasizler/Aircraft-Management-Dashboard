"use client";

import { useEffect } from "react";

export function Modal({
  title,
  onClose,
  children,
  obscure,
  dismissible = true,
}: {
  title: string;
  onClose: () => void;
  children: React.ReactNode;
  /**
   * Blur and darken the page behind. For a dialog that fires because the
   * viewer lost the right to what's underneath — being revoked while reading
   * an aircraft's insurance shouldn't leave the premiums legible through a
   * translucent backdrop.
   */
  obscure?: boolean;
  /** False when the only way out is an explicit choice in the dialog. */
  dismissible?: boolean;
}) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && dismissible) onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose, dismissible]);

  return (
    <div
      className={`modal-overlay open${obscure ? " obscured" : ""}`}
      onClick={dismissible ? onClose : undefined}
    >
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <h3>{title}</h3>
        {children}
      </div>
    </div>
  );
}
