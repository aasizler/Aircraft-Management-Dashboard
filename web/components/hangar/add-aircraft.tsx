"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Modal } from "@/components/ui/modal";
import { Icon } from "@/components/ui/icon";
import { useToast } from "@/components/ui/toast";
import {
  AirportAutocomplete,
  EngineAutocomplete,
  TypeAutocomplete,
} from "@/components/ui/autocomplete";
import { makeCoreInspections, type V1Aircraft } from "@/lib/aircraft";
import { METER_LABEL } from "@/lib/aircraft";
import type { AcClass, AcType } from "@/lib/reference-data";
import { orderKinds, profileFor, profileForClass, type MeterProfile } from "@/lib/meters";
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
  fleets = [],
}: {
  /** Absent for an account that hasn't got a hangar yet. */
  orgId?: string | null;
  /** Used to name the hangar created on first use. */
  hangarName?: string | null;
  /** Sections of the hangar this aircraft can be filed under on creation. */
  fleets?: { id: string; name: string }[];
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
    maintHrs: "",
    costHrs: "",
    overhaulAt: "",
    tbo: "1700",
    oilInterval: "50",
    fleet_id: "",
  });
  // Piston until the catalogue says otherwise — that's what a free-typed
  // aircraft type has always been treated as.
  const [cls, setCls] = useState<AcClass>("piston");
  const turbine = cls !== "piston";
  // What clocks the airframe carries. Drives the defaults and the ordering of
  // the two selects; every kind stays selectable underneath.
  const [profile, setProfile] = useState<MeterProfile>(profileForClass("piston"));

  const set = (k: keyof typeof f, v: string) => setF((p) => ({ ...p, [k]: v }));


  /**
   * A turbine carries neither the piston TBO default nor an hours-based oil
   * interval, so picking one out of the catalogue clears both rather than
   * leaving 1700/50 sitting in the fields looking authoritative.
   */
  function pickType(t: AcType) {
    const next = t.cls ?? "piston";
    const prof = profileFor(t.icao, next);
    setCls(next);
    setProfile(prof);
    setF((p) => ({
      ...p,
      tbo: next === "piston" ? (p.tbo || "1700") : p.tbo === "1700" ? "" : p.tbo,
      oilInterval: next === "piston" ? (p.oilInterval || "50") : "",
      // Point the bases at the clocks this airframe actually has, rather than
      // leaving both on hobbs and hoping someone notices.
      maint_basis: prof.maint,
      cost_basis: prof.cost,
    }));
  }

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

    // The meters are the readings now. Airframe total time is the total-time
    // clock where the aeroplane has one, and otherwise the cost clock, which is
    // the closest thing it keeps to total time.
    const meterRead = (kind: MeterKind) =>
      Number(kind === f.maint_basis ? f.maintHrs : f.costHrs) || 0;
    const meterKinds = Array.from(new Set([f.maint_basis, f.cost_basis]));
    const hrs = meterKinds.includes("total") ? meterRead("total") : meterRead(f.cost_basis);

    // v1's saveAircraft() seeded the regulatory inspection set and the TBO /
    // oil-interval defaults. The first port inserted `data: {}`, leaving a new
    // aircraft with no inspections and no way to add any.
    const data: V1Aircraft = {
      inspections: makeCoreInspections(cls),
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
      acClass: cls,
      tt: hrs,
      overhaulAt: Number(f.overhaulAt) || 0,
      // Written too, so anything still reading the old field sees today's
      // number rather than nothing. smohOf() prefers overhaulAt.
      engineSMOH: Math.max(0, meterRead(f.maint_basis) - (Number(f.overhaulAt) || 0)),
      // No piston fallbacks on a turbine: an unset TBO stays unset, and a zero
      // oil interval is how oilLife() knows there is no oil clock to show.
      tbo: Number(f.tbo) || (turbine ? 0 : 1700),
      oilInterval: Number(f.oilInterval) || (turbine ? 0 : 50),
      oilHobbs: meterRead(f.maint_basis),
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
        fleet_id: f.fleet_id || null,
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

    // One row per clock the airframe carries, each with its own reading.
    await supabase
      .from("aircraft_meters")
      .insert(meterKinds.map((kind) => ({ aircraft_id: id, kind, current: meterRead(kind) })));

    const reg = f.reg.trim().toUpperCase();
    setBusy(false);
    setOpen(false);
    setF({
      reg: "", type: "", serial: "", airport: "", engineType: "",
      maint_basis: "hobbs", cost_basis: "hobbs", fleet_id: "",
      overhaulAt: "", tbo: "1700", oilInterval: "50",
      maintHrs: "", costHrs: "",
    });
    setCls("piston");
    setProfile(profileForClass("piston"));
    toast(`${reg} added to the hangar`, "ok");
    router.refresh();
  }

  return (
    <>
      <button className="btn primary" onClick={() => setOpen(true)}>
        <Icon name="plane" size={15} />Add Aircraft
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
            <TypeAutocomplete
              value={f.type}
              onChange={(v) => set("type", v)}
              onResolve={pickType}
            />
          </div>

          <div className="form-row">
            <label>Engine Type</label>
            <EngineAutocomplete
              value={f.engineType}
              onChange={(v) => set("engineType", v)}
              onResolve={(e) => setF((p) => ({ ...p, tbo: String(e.tbo) }))}
            />
          </div>

          {/* Airframe hours are not asked for here: they are a meter reading,
              and Meters below is where the readings live. */}
          <div className="form-grid">
            <div className="form-row">
              <label>Engine Overhauled At (hrs)</label>
              <input type="number" step="0.1" value={f.overhaulAt} onChange={(e) => set("overhaulAt", e.target.value)} placeholder="0" />
              <div style={{ fontSize: 10, color: "var(--muted2)", marginTop: 4 }}>
                {METER_LABEL[f.maint_basis]} reading at overhaul — 0 if never overhauled
              </div>
            </div>
            <div className="form-row">
              <label>{turbine ? "Engine TBO / Program Interval (hrs)" : "Engine TBO (hrs)"}</label>
              <input type="number" value={f.tbo} onChange={(e) => set("tbo", e.target.value)} placeholder={turbine ? "4000" : "1700"} />
              <div style={{ fontSize: 10, color: "var(--muted2)", marginTop: 4 }}>
                Auto-filled from engine type — adjust as needed
              </div>
            </div>
          </div>

          {/* A turbine has no fixed-hour oil change — oil is serviced on
              consumption, so the field is dropped rather than shown empty. */}
          {!turbine && (
            <div className="form-grid">
              <div className="form-row">
                <label>Oil Change Interval (hrs)</label>
                <input type="number" value={f.oilInterval} onChange={(e) => set("oilInterval", e.target.value)} />
              </div>
            </div>
          )}

          <div className="form-row">
            <label>Home Airport</label>
            <AirportAutocomplete value={f.airport} onChange={(v) => set("airport", v)} />
          </div>

          {/* Filing it on creation. Without this a new aircraft always landed
              ungrouped and had to be moved from its settings afterwards. */}
          {fleets.length > 0 && (
            <div className="form-row">
              <label>Fleet</label>
              <select value={f.fleet_id} onChange={(e) => set("fleet_id", e.target.value)}>
                <option value="">No fleet</option>
                {fleets.map((fl) => (
                  <option key={fl.id} value={fl.id}>{fl.name}</option>
                ))}
              </select>
            </div>
          )}

          {/* Meters have no v1 equivalent — v2 tracks which clock drives what. */}
          <div className="form-divider">Meters</div>
          <div className="how-box" style={{ marginBottom: 12 }}>{profile.note}</div>
          <div className="form-grid">
            <div className="form-row">
              <label>Maintenance clock</label>
              <select value={f.maint_basis} onChange={(e) => set("maint_basis", e.target.value)}>
                {orderKinds(profile, METERS).map((m) => (
                  <option key={m} value={m}>{METER_LABEL[m]}</option>
                ))}
              </select>
              <div style={{ fontSize: 10, color: "var(--muted2)", marginTop: 4 }}>
                Inspections, SMOH and oil count against this
              </div>
            </div>
            <div className="form-row">
              <label>Current {METER_LABEL[f.maint_basis]}</label>
              <input
                type="number" step="0.1" value={f.maintHrs} placeholder="1243"
                onChange={(e) => set("maintHrs", e.target.value)}
              />
            </div>
          </div>
          <div className="form-grid">
            <div className="form-row">
              <label>Cost clock</label>
              <select value={f.cost_basis} onChange={(e) => set("cost_basis", e.target.value)}>
                {orderKinds(profile, METERS).map((m) => (
                  <option key={m} value={m}>{METER_LABEL[m]}</option>
                ))}
              </select>
              <div style={{ fontSize: 10, color: "var(--muted2)", marginTop: 4 }}>
                Billing and $/hr count against this
              </div>
            </div>
            <div className="form-row">
              <label>Current {METER_LABEL[f.cost_basis]}</label>
              <input
                type="number" step="0.1"
                value={f.cost_basis === f.maint_basis ? f.maintHrs : f.costHrs}
                disabled={f.cost_basis === f.maint_basis}
                placeholder="1243"
                onChange={(e) => set("costHrs", e.target.value)}
              />
              {f.cost_basis === f.maint_basis && (
                <div style={{ fontSize: 10, color: "var(--muted2)", marginTop: 4 }}>
                  Same meter as the maintenance clock — one reading drives both
                </div>
              )}
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
