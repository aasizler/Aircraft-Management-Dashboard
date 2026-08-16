"use client";

import { createContext, useCallback, useContext, useState } from "react";

// Replaces v1's showToast()/dismissToast(). The first port had no toast system
// at all, so failed saves surfaced only as a badge turning red with no message.

type ToastKind = "ok" | "warn" | "danger" | "info";
type Toast = { id: number; msg: string; kind: ToastKind };

const Ctx = createContext<(msg: string, kind?: ToastKind) => void>(() => {});

export const useToast = () => useContext(Ctx);

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const show = useCallback((msg: string, kind: ToastKind = "info") => {
    const id = Date.now() + Math.random();
    setToasts((t) => [...t, { id, msg, kind }]);
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 4200);
  }, []);

  return (
    <Ctx.Provider value={show}>
      {children}
      <div className="toast-wrap">
        {toasts.map((t) => (
          <div key={t.id} className={`toast ${t.kind}`} onClick={() => setToasts((x) => x.filter((y) => y.id !== t.id))}>
            <span className="toast-dot" />
            <span>{t.msg}</span>
          </div>
        ))}
      </div>
    </Ctx.Provider>
  );
}
