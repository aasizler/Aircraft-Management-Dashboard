"use client";

import { useEffect, useRef, useState } from "react";

// The ⋮ row menu from v1 (toggleRowMenu / toggleSqMenu), including the
// click-outside close the first port's dot menus were missing.
export function RowMenu({
  items,
}: {
  items: { label: string; onClick: () => void; danger?: boolean }[];
}) {
  const [open, setOpen] = useState(false);
  const wrap = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (!wrap.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("mousedown", onDoc);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDoc);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <div className="row-dot-wrap" ref={wrap}>
      <button
        className="row-dot-btn"
        title="More"
        aria-label="More actions"
        onClick={() => setOpen((o) => !o)}
      >
        <span /><span /><span />
      </button>
      {open && (
        <div className="row-dot-menu open">
          {items.map((it) => (
            <button
              key={it.label}
              className={`row-dot-item${it.danger ? " danger-item" : ""}`}
              onClick={() => { setOpen(false); it.onClick(); }}
            >
              {it.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
