"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Modal } from "@/components/ui/modal";
import { useToast } from "@/components/ui/toast";
import {
  AirportAutocomplete,
  EngineAutocomplete,
  TypeAutocomplete,
} from "@/components/ui/autocomplete";
import { makeCoreInspections, type V1Aircraft } from "@/lib/aircraft";
import type { MeterKind } from "@/lib/types";

const METERS: MeterKind[] = ["hobbs", "tach", "flight", "total"];

/**
 * A hangar is an org with one member in it, and a solo owner never needs to
 * hear that word. When they have no org yet, pressing Add Aircraft creates one
 * named after them first — no extra step, no vocabulary to learn. The concept
 * only surfaces once they invite somebody or group aircraft into a fleet.
 */
export function AddAircraftButton({
  orgId,
  hangarName,
}: {
  /** Absent for an account that hasn't got a hangar yet. */
  orgId?: string | null;
  /** Used to name the hangar created on first use. */
  hangarName?: string | null;
}) {
  const router = useRouter();
  const toast = useToast();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [f, setF] = useState({
    reg: "",
    type: "",
    serial: "",
    airport: "",
    engineType: "",
    maint_basis: "hobbs" as MeterKind,
    cost_basis: "hobbs" as MeterKind,
    hours: "",
    engineSMOH: "",
    tbo: "1700",
    oilInterval: "50",
  });

  const set = (k: keyof typeof f, v: string) => setF((p) => ({ ...p, [k]: v }));

  async function submit() {
    if (!f.reg.trim()) { setErr("Registration is required."); return; }
    if (!f.type.trim()) { setErr("Aircraft Type / Model is required."); return; }
    setBusy(true);
    setErr(null);
    const supabase = createClient();

    // First aircraft on a new account: make the hangar it goes in. Silently —
    // create_org does the org and the membership together, because the two
    // policies deadlock for someone who isn't a member yet.
    let org: string | null | undefined = orgId;
    if (!org) {
      const { error: orgErr } = await supabase.rpc("create_org", {
        p_name: hangarName?.trim() ? `${hangarName.trim()}'s Hangar` : "My Hangar",
      });
      // "already belong" isn't a failure here — it means this page was rendered
      // before the hangar existed and its orgId prop is simply stale.
      if (orgErr && !/already belong/i.test(orgErr.message)) {
        setErr(orgErr.message);
        setBusy(false);
        return;
      }
      // Read the membership back rather than trusting the call's return value.
      // Taking the returned id on faith is what broke this: the hangar and the
      // membership were both created, the id never reached the insert, and the
      // aircraft went in with org_id null — surfacing as an RLS violation that
      // pointed at the wrong thing entirely.
      // No user filter needed — the members read policy already scopes this to
      // orgs you belong to, and depending on getUser() here just adds another
      // way for it to come back empty.
      const { data: m } = await supabase
        .from("org_members")
        .select("org_id")
        .limit(1)
        .maybeSingle();
      org = m?.org_id;
    }

    if (!org) {
      setErr("Could not find your hangar. Reload the page and try again.");
      setBusy(false);
      return;
    }

    const hrs = f.hours ? Number(f.hours) : 0;

    // v1's saveAircraft() seeded the regulatory inspection set and the TBO /
    // oil-interval defaults. The first port inserted `data: {}`, leaving a new
    // aircraft with no inspections and no way to add any.
    const data: V1Aircraft = {
      inspections: makeCoreInspections(),
      oil: [],
      squawks: [],
      squawkArchive: [],
      flights: [],
      flightRoutes: [],
      maintCosts: [],
      schedule: [],
      documents: [],
      monthlyHours: [0, 0, 0, 0, 0, 0],
      oilByMonth: [0, 0, 0, 0, 0, 0],
      airportData: null,
      insurance: {
        provider: "", policy: "", effective: "", expiration: "",
        hull: 0, liability: "", deductible: "", pilots: [], documents: [],
      },
      engineType: f.engineType.trim() || null,
      tt: hrs,
      engineSMOH: Number(f.engineSMOH) || 0,
      tbo: Number(f.tbo) || 1700,
      oilInterval: Number(f.oilInterval) || 50,
      oilHobbs: hrs,
      oilChangeDate: "",
      lastUpdated: "Not yet updated",
    };

    // The id is generated here rather than returned by the insert, and that is
    // load-bearing. .select() after an insert compiles to INSERT … RETURNING,
    // and Postgres applies the SELECT policy to the returned row as well as the
    // WITH CHECK. That policy is can_read_aircraft(id), which re-queries the
    // aircraft table for the row still being inserted by the same command — it
    // finds nothing, denies the read, and the whole statement fails as
    // "new row violates row-level security policy for table aircraft". Adding
    // an aircraft through the UI has never worked; the existing fleet arrived
    // through the SQL import.
    const id = crypto.randomUUID();

    const { error } = await supabase
      .from("aircraft")
      .insert({
        id,
        org_id: org,
        reg: f.reg.trim().toUpperCase(),
        type: f.type.trim() || null,
        serial: f.serial.trim() || null,
        airport: f.airport.trim() || null,
        maint_basis: f.maint_basis,
        cost_basis: f.cost_basis,
        data,
      });

    if (error) {
      // "violates row-level security policy" names the table and tells you
      // nothing about why. The only insert policy here is is_org_staff(org_id),
      // so ask it directly and say which of the two things actually went wrong.
      if (error && /row-level security/i.test(error.message)) {
        const { data: staff } = await supabase.rpc("is_org_staff", { p_org: org });
        setErr(
          staff
            ? `The database refused this even though you administer hangar ${org}. Reload and try again.`
            : `You don't have permission to add aircraft to hangar ${org ?? "(none)"}.`,
        );
        setBusy(false);
        return;
      }
      setErr(error?.message ?? "Could not create aircraft.");
      setBusy(false);
      return;
    }

    // Seed the meters the airframe carries (maint + cost bases; deduped).
    const kinds = Array.from(new Set([f.maint_basis, f.cost_basis]));
    await supabase
      .from("aircraft_meters")
      .insert(kinds.map((kind) => ({ aircraft_id: id, kind, current: hrs })));

    const reg = f.reg.trim().toUpperCase();
    setBusy(false);
    setOpen(false);
    setF({
      reg: "", type: "", serial: "", airport: "", engineType: "",
      maint_basis: "hobbs", cost_basis: "hobbs", hours: "",
      engineSMOH: "", tbo: "1700", oilInterval: "50",
    });
    toast(`${reg} added to the hangar`, "ok");
    router.refresh();
  }

  return (
    <>
      <button className="btn primary" onClick={() => setOpen(true)}>
        + Add Aircraft
      </button>

      {open && (
        <Modal title="Add Aircraft" onClose={() => setOpen(false)}>
          <div className="form-grid">
            <div className="form-row">
              <label>Registration</label>
              <input value={f.reg} onChange={(e) => set("reg", e.target.value)} placeholder="e.g. N12345" />
            </div>
            <div className="form-row">
              <label>Serial Number</label>
              <input value={f.serial} onChange={(e) => set("serial", e.target.value)} placeholder="e.g. U-8472" />
            </div>
          </div>

          <div className="form-row">
            <label>Aircraft Type / Model</label>
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
              <input type="number" step="0.1" value={f.hours} onChange={(e) => set("hours", e.target.value)} placeholder="1243" />
            </div>
            <div className="form-row">
              <label>Engine SMOH Hours</label>
              <input type="number" step="0.1" value={f.engineSMOH} onChange={(e) => set("engineSMOH", e.target.value)} placeholder="441" />
            </div>
          </div>

          <div className="form-grid">
            <div className="form-row">
              <label>Engine TBO (hrs)</label>
              <input type="number" value={f.tbo} onChange={(e) => set("tbo", e.target.value)} />
              <div style={{ fontSize: 10, color: "var(--muted2)", marginTop: 4 }}>
                Auto-filled from engine type — adjust as needed
              </div>
            </div>
            <div className="form-row">
              <label>Oil Change Interval (hrs)</label>
              <input type="number" value={f.oilInterval} onChange={(e) => set("oilInterval", e.target.value)} />
            </div>
          </div>

          <div className="form-row">
            <label>Home Airport</label>
            <AirportAutocomplete value={f.airport} onChange={(v) => set("airport", v)} />
          </div>

          {/* Meters have no v1 equivalent — v2 tracks which clock drives what. */}
          <div className="form-divider">Meters</div>
          <div className="form-grid">
            <div className="form-row">
              <label>Maintenance clock</label>
              <select value={f.maint_basis} onChange={(e) => set("maint_basis", e.target.value)}>
                {METERS.map((m) => <option key={m} value={m}>{m}</option>)}
              </select>
            </div>
            <div className="form-row">
              <label>Cost clock</label>
              <select value={f.cost_basis} onChange={(e) => set("cost_basis", e.target.value)}>
                {METERS.map((m) => <option key={m} value={m}>{m}</option>)}
              </select>
            </div>
          </div>

          {err && <div className="auth-err">{err}</div>}
          <div className="form-actions">
            <button className="btn-cancel" onClick={() => setOpen(false)}>Cancel</button>
            <button className="btn-save" onClick={submit} disabled={busy}>
              {busy ? "Creating…" : "Add Aircraft"}
            </button>
          </div>
        </Modal>
      )}
    </>
  );
}
