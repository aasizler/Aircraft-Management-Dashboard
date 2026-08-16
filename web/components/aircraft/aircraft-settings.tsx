"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Modal } from "@/components/ui/modal";
import { useToast } from "@/components/ui/toast";
import {
  AirportAutocomplete,
  EngineAutocomplete,
  TypeAutocomplete,
} from "@/components/ui/autocomplete";
import type { AircraftRow, Meter, V1Aircraft } from "@/lib/aircraft";
import type { MeterKind } from "@/lib/types";

const METERS: MeterKind[] = ["hobbs", "tach", "flight", "total"];

/**
 * Ports v1's Aircraft Settings modal (openTileSettings / saveSettings). The
 * first port had no edit path at all — once an aircraft was created its
 * registration, type, airport, hours, TBO and oil interval were unreachable.
 *
 * Writes span three places: the `aircraft` columns, the `data` blob (the v1
 * fields the tabs read), and `aircraft_meters` for the current hour readings.
 */
export function AircraftSettings({
  aircraft,
  meters,
  data,
  save,
  hidden,
}: {
  aircraft: AircraftRow;
  meters: Meter[];
  data: V1Aircraft;
  save: (next: V1Aircraft) => Promise<void>;
  /** Render only the modal — the trigger lives in the nav ⋮ menu. */
  hidden?: boolean;
}) {
  const router = useRouter();
  const toast = useToast();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const meterOf = (k: MeterKind) => meters.find((m) => m.kind === k)?.current ?? 0;

  const [f, setF] = useState({
    reg: aircraft.reg,
    serial: aircraft.serial ?? "",
    type: aircraft.type ?? "",
    airport: aircraft.airport ?? "",
    engineType: (data.engineType as string) ?? "",
    tt: data.tt != null ? String(data.tt) : "",
    engineSMOH: data.engineSMOH != null ? String(data.engineSMOH) : "",
    tbo: data.tbo != null ? String(data.tbo) : "1700",
    oilInterval: data.oilInterval != null ? String(data.oilInterval) : "50",
    maint_basis: aircraft.maint_basis,
    cost_basis: aircraft.cost_basis,
    maintHrs: String(meterOf(aircraft.maint_basis)),
    costHrs: String(meterOf(aircraft.cost_basis)),
  });

  const set = (k: keyof typeof f, v: string) => setF((p) => ({ ...p, [k]: v }));

  // Opened from the nav ⋮ menu, and from the hangar tile menu via ?settings=1
  // (v1 opened the same modal straight from the tile).
  useEffect(() => {
    const openIt = () => setOpen(true);
    window.addEventListener("aerotrack:aircraft-settings", openIt);
    if (new URLSearchParams(window.location.search).has("settings")) {
      openIt();
      window.history.replaceState({}, "", window.location.pathname);
    }
    return () => window.removeEventListener("aerotrack:aircraft-settings", openIt);
  }, []);

  async function submit() {
    if (!f.reg.trim()) { setErr("Registration is required."); return; }
    setBusy(true);
    setErr(null);
    const supabase = createClient();

    const { error } = await supabase
      .from("aircraft")
      .update({
        reg: f.reg.trim().toUpperCase(),
        serial: f.serial.trim() || null,
        type: f.type.trim() || null,
        airport: f.airport.trim() || null,
        maint_basis: f.maint_basis,
        cost_basis: f.cost_basis,
      })
      .eq("id", aircraft.id);

    if (error) {
      setErr(error.message);
      setBusy(false);
      return;
    }

    // Meters: upsert whichever kinds the two bases point at.
    const wanted = Array.from(new Set([f.maint_basis, f.cost_basis]));
    const rows = wanted.map((kind) => ({
      aircraft_id: aircraft.id,
      kind,
      current: Number(kind === f.maint_basis ? f.maintHrs : f.costHrs) || 0,
    }));
    const { error: mErr } = await supabase
      .from("aircraft_meters")
      .upsert(rows, { onConflict: "aircraft_id,kind" });
    if (mErr) {
      setErr(mErr.message);
      setBusy(false);
      return;
    }

    await save({
      ...data,
      engineType: f.engineType.trim() || null,
      tt: f.tt === "" ? undefined : Number(f.tt),
      engineSMOH: f.engineSMOH === "" ? undefined : Number(f.engineSMOH),
      tbo: Number(f.tbo) || 1700,
      oilInterval: Number(f.oilInterval) || 50,
      lastUpdated:
        "Updated " +
        new Date().toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }),
    });

    setBusy(false);
    setOpen(false);
    toast("Aircraft settings saved", "ok");
    router.refresh();
  }

  return (
    <>
      {!hidden && (
        <button className="btn sm" onClick={() => setOpen(true)}>
          Settings
        </button>
      )}

      {open && (
        <Modal title="Aircraft Settings" onClose={() => setOpen(false)}>
          <div className="form-grid">
            <div className="form-row">
              <label>Registration *</label>
              <input value={f.reg} onChange={(e) => set("reg", e.target.value)} />
            </div>
            <div className="form-row">
              <label>Serial Number</label>
              <input value={f.serial} onChange={(e) => set("serial", e.target.value)} />
            </div>
          </div>

          <div className="form-row">
            <label>Aircraft Type</label>
            <TypeAutocomplete value={f.type} onChange={(v) => set("type", v)} />
          </div>

          <div className="form-row">
            <label>Engine Type</label>
            <EngineAutocomplete
              value={f.engineType}
              onChange={(v) => set("engineType", v)}
              onResolve={(e) => setF((p) => ({ ...p, tbo: String(e.tbo) }))}
            />
          </div>

          <div className="form-grid">
            <div className="form-row">
              <label>Total Airframe Hours</label>
              <input type="number" step="0.1" value={f.tt} onChange={(e) => set("tt", e.target.value)} />
            </div>
            <div className="form-row">
              <label>Engine SMOH Hours</label>
              <input type="number" step="0.1" value={f.engineSMOH} onChange={(e) => set("engineSMOH", e.target.value)} />
            </div>
          </div>

          <div className="form-grid">
            <div className="form-row">
              <label>Engine TBO (hrs)</label>
              <input type="number" value={f.tbo} onChange={(e) => set("tbo", e.target.value)} />
            </div>
            <div className="form-row">
              <label>Oil Interval (hrs)</label>
              <input type="number" value={f.oilInterval} onChange={(e) => set("oilInterval", e.target.value)} />
            </div>
          </div>

          <div className="form-row">
            <label>Home Airport</label>
            <AirportAutocomplete value={f.airport} onChange={(v) => set("airport", v)} />
          </div>

          <div className="form-divider">Meters</div>
          <div className="form-grid">
            <div className="form-row">
              <label>Maintenance clock</label>
              <select value={f.maint_basis} onChange={(e) => set("maint_basis", e.target.value)}>
                {METERS.map((m) => <option key={m} value={m}>{m}</option>)}
              </select>
            </div>
            <div className="form-row">
              <label>Current {f.maint_basis} hours</label>
              <input type="number" step="0.1" value={f.maintHrs} onChange={(e) => set("maintHrs", e.target.value)} />
            </div>
          </div>
          <div className="form-grid">
            <div className="form-row">
              <label>Cost clock</label>
              <select value={f.cost_basis} onChange={(e) => set("cost_basis", e.target.value)}>
                {METERS.map((m) => <option key={m} value={m}>{m}</option>)}
              </select>
            </div>
            <div className="form-row">
              <label>Current {f.cost_basis} hours</label>
              <input
                type="number" step="0.1"
                value={f.cost_basis === f.maint_basis ? f.maintHrs : f.costHrs}
                disabled={f.cost_basis === f.maint_basis}
                onChange={(e) => set("costHrs", e.target.value)}
              />
            </div>
          </div>

          {err && <div className="auth-err">{err}</div>}
          <div className="form-actions">
            <button className="btn-cancel" onClick={() => setOpen(false)}>Cancel</button>
            <button className="btn-save" onClick={submit} disabled={busy}>
              {busy ? "Saving…" : "Save Changes"}
            </button>
          </div>
        </Modal>
      )}
    </>
  );
}
