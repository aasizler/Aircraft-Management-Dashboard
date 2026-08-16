"use client";

import { createContext, useCallback, useContext, useState } from "react";

// Replaces v1's showToast()/dismissToast(). The first port had no toast system
// at all, so failed saves surfaced only as a badge turning red with no message.

type ToastKind = "ok" | "warn" | "danger" | "info";

export type ToastAction = {
  label: string;
  onClick: () => void;
  /** Renders as the filled action. One per toast. */
  primary?: boolean;
};

/**
 * A notification about a person and an aircraft, rather than a bare sentence.
 * Emails told you less at a glance than names once more than one person shared
 * an aircraft, and an alert about an aircraft you aren't looking at had nowhere
 * to take you — v1's invite toast carried a Review link and the port lost it.
 */
export type RichToast = {
  /** Usually the person. Falls back to an event name when nobody is involved. */
  title: string;
  detail?: string;
  /** Registration, shown in mono beside the title. */
  reg?: string;
  /** Drives the initials. Omit for events with no person behind them. */
  who?: string;
  actions?: ToastAction[];
};

type ToastInput = string | RichToast;
type Toast = { id: number; kind: ToastKind; msg?: string; rich?: RichToast };

const Ctx = createContext<(input: ToastInput, kind?: ToastKind) => void>(() => {});

export const useToast = () => useContext(Ctx);

/** "Elizabeth Berry" → EB, "aasizler@yahoo.com" → AA. Never more than two. */
function initials(name: string): string {
  const words = name.trim().split(/\s+/).filter(Boolean);
  if (words.length > 1) {
    return (words[0][0] + words[words.length - 1][0]).toUpperCase();
  }
  return (words[0]?.slice(0, 2) ?? "?").toUpperCase();
}

/** Plain notices clear quickly; one asking for a decision has to outlast reading it. */
const PLAIN_MS = 4_200;
const ACTIONABLE_MS = 10_000;

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const dismiss = useCallback((id: number) => {
    setToasts((t) => t.filter((x) => x.id !== id));
  }, []);

  const show = useCallback(
    (input: ToastInput, kind: ToastKind = "info") => {
      const id = Date.now() + Math.random();
      const rich = typeof input === "string" ? undefined : input;
      setToasts((t) => [
        ...t,
        { id, kind, msg: typeof input === "string" ? input : undefined, rich },
      ]);
      setTimeout(
        () => setToasts((t) => t.filter((x) => x.id !== id)),
        rich?.actions?.length ? ACTIONABLE_MS : PLAIN_MS,
      );
    },
    [],
  );

  return (
    <Ctx.Provider value={show}>
      {children}
      <div className="toast-wrap">
        {toasts.map((t) =>
          t.rich ? (
            // Clicking the card still dismisses, as it always has. Actions stop
            // propagation so a deliberate press doesn't also count as one —
            // making the whole card navigate would fire on an idle tap, and
            // only some toasts have anywhere to go.
            <div
              key={t.id}
              className={`toast rich ${t.kind}`}
              onClick={() => dismiss(t.id)}
            >
              {t.rich.who ? (
                <span className="toast-av">{initials(t.rich.who)}</span>
              ) : (
                <span className="toast-av glyph">•</span>
              )}
              <div className="toast-body">
                <div className="toast-hd">
                  <span className="toast-ttl">{t.rich.title}</span>
                  {t.rich.reg && <span className="toast-reg">{t.rich.reg}</span>}
                </div>
                {t.rich.detail && <div className="toast-sub">{t.rich.detail}</div>}
                {!!t.rich.actions?.length && (
                  <div className="toast-acts">
                    {t.rich.actions.map((a) => (
                      <button
                        key={a.label}
                        className={`toast-btn${a.primary ? " pri" : ""}`}
                        onClick={(e) => {
                          e.stopPropagation();
                          a.onClick();
                          dismiss(t.id);
                        }}
                      >
                        {a.label}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>
          ) : (
            <div
              key={t.id}
              className={`toast ${t.kind}`}
              onClick={() => dismiss(t.id)}
            >
              <span className="toast-dot" />
              <span>{t.msg}</span>
            </div>
          ),
        )}
      </div>
    </Ctx.Provider>
  );
}
