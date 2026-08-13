"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Modal } from "@/components/ui/modal";
import type { AircraftRow } from "@/lib/aircraft";
import type { MeterKind } from "@/lib/types";

const KINDS: MeterKind[] = ["hobbs", "tach", "flight", "total"];
type Values = Partial<Record<MeterKind, number>>;

async function toBase64(file: File): Promise<{ data: string; media: string }> {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => {
      const s = String(r.result);
      resolve({ data: s.split(",")[1], media: file.type || "image/jpeg" });
    };
    r.onerror = reject;
    r.readAsDataURL(file);
  });
}

export function MeterCapture({ aircraft }: { aircraft: AircraftRow }) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [open, setOpen] = useState(false);
  const [phase, setPhase] = useState<"pick" | "scanning" | "confirm">("pick");
  const [raw, setRaw] = useState<Values>({});
  const [vals, setVals] = useState<Values>({});
  const [notes, setNotes] = useState<string>("");
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  function reset() {
    setPhase("pick");
    setRaw({});
    setVals({});
    setNotes("");
    setErr(null);
  }

  async function scan(file: File) {
    setPhase("scanning");
    setErr(null);
    try {
      const { data, media } = await toBase64(file);
      const supabase = createClient();
      const {
        data: { session },
      } = await supabase.auth.getSession();
      const res = await fetch(
        `${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/meter-ocr`,
        {
          method: "POST",
          headers: {
            "content-type": "application/json",
            authorization: `Bearer ${session?.access_token ?? ""}`,
          },
          body: JSON.stringify({ image: data, media_type: media }),
        },
      );
      const out = await res.json();
      if (!res.ok || out.error) {
        setErr(out.error ?? `OCR failed (${res.status})`);
        setPhase("pick");
        return;
      }
      const v = (out.values ?? {}) as Values;
      setRaw(v);
      setVals(v);
      setNotes(out.notes ?? "");
      setPhase("confirm");
    } catch (e) {
      setErr(String(e));
      setPhase("pick");
    }
  }

  async function apply() {
    setBusy(true);
    setErr(null);
    const supabase = createClient();
    const final: Values = {};
    for (const k of KINDS) if (vals[k] != null) final[k] = vals[k];

    const { data: row, error } = await supabase
      .from("meter_readings")
      .insert({
        aircraft_id: aircraft.id,
        org_id: aircraft.org_id,
        values_raw: raw,
        values_final: final,
        status: "pending",
      })
      .select("id")
      .single();
    if (error || !row) {
      setErr(error?.message ?? "could not save reading");
      setBusy(false);
      return;
    }

    // Validated commit — re-checks monotonicity + <50hr delta server-side.
    const { data: result, error: rpcErr } = await supabase.rpc(
      "apply_meter_reading",
      { p_reading: row.id },
    );
    setBusy(false);
    if (rpcErr) {
      setErr(rpcErr.message);
      return;
    }
    if (result && result.ok === false) {
      setErr(
        result.reason === "below_current"
          ? `Reading is below current hours (${result.meter}: ${result.current}).`
          : result.reason === "implausible_delta"
            ? `Jump of ${result.delta} hrs looks wrong — check the reading.`
            : `Rejected: ${result.reason}`,
      );
      return;
    }
    setOpen(false);
    reset();
    router.refresh();
  }

  return (
    <>
      <button className="btn sm" onClick={() => setOpen(true)}>
        📷 Meter Photo
      </button>

      {open && (
        <Modal
          title="Capture Meter Photo"
          onClose={() => {
            setOpen(false);
            reset();
          }}
        >
          {phase === "pick" && (
            <>
              <div
                className="pdf-drop"
                onClick={() => inputRef.current?.click()}
              >
                <div className="pdf-drop-icon">📷</div>
                <div className="pdf-drop-title">Photograph the meter</div>
                <div className="pdf-drop-sub">
                  Hobbs, tach, or flight timer — click to choose a photo
                </div>
                <input
                  ref={inputRef}
                  type="file"
                  accept="image/*"
                  capture="environment"
                  style={{ display: "none" }}
                  onChange={(e) => e.target.files?.[0] && scan(e.target.files[0])}
                />
              </div>
              {err && <div className="auth-err">{err}</div>}
            </>
          )}

          {phase === "scanning" && (
            <div style={{ textAlign: "center", padding: "24px 0" }}>
              <div className="receipt-spinner" style={{ margin: "0 auto 14px" }} />
              <div className="mono">Reading the meter…</div>
            </div>
          )}

          {phase === "confirm" && (
            <>
              <div className="how-box" style={{ marginBottom: 12 }}>
                Confirm the reading before it updates hours. {notes ? <b>{notes}</b> : null}
              </div>
              <div className="form-grid">
                {KINDS.filter((k) => vals[k] != null || raw[k] != null).map((k) => (
                  <div className="form-row" key={k}>
                    <label>{k}</label>
                    <input
                      type="number"
                      step="0.1"
                      value={vals[k] ?? ""}
                      onChange={(e) =>
                        setVals((p) => ({ ...p, [k]: Number(e.target.value) }))
                      }
                    />
                  </div>
                ))}
              </div>
              {err && <div className="auth-err">{err}</div>}
              <div className="form-actions">
                <button className="btn-cancel" onClick={reset}>Retake</button>
                <button className="btn-save" onClick={apply} disabled={busy}>
                  {busy ? "Applying…" : "Confirm & Update Hours"}
                </button>
              </div>
            </>
          )}
        </Modal>
      )}
    </>
  );
}
