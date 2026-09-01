"use client";

import { useCallback, useState } from "react";
import { Icon } from "@/components/ui/icon";
import { useLivePosition, nearestAirport, type Landing } from "@/lib/adsb";
import { pushLiveFlight } from "@/lib/flight-history";
import { loadAirportDb } from "@/lib/airports";
import { AdsbPanel } from "./adsb-panel";
import { Modal } from "@/components/ui/modal";
import { today, type FlightEntry, type RouteEntry, type V1Aircraft } from "@/lib/aircraft";
import { useToast } from "@/components/ui/toast";

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <span className="adsb-stat">
      <span className="adsb-stat-val">{value}</span>
      <span className="adsb-stat-lbl">{label}</span>
    </span>
  );
}

/**
 * Live ADS-B banner shown under the hero. Polls adsb.lol every 10s, shows a
 * telemetry panel while airborne, and — restoring v1's _adsbCheckLanding /
 * _showLandingPrompt / prefillFlightFromAdsb — offers to log the flight once
 * the aircraft is back on the ground.
 */
export function LiveBanner({
  reg,
  aircraftId,
  data,
  save,
}: {
  reg: string;
  aircraftId?: string;
  data?: V1Aircraft;
  save?: (next: V1Aircraft) => Promise<void>;
}) {
  const toast = useToast();
  const [landing, setLanding] = useState<Landing | null>(null);
  const [form, setForm] = useState({ from: "", to: "", notes: "" });

  const onLanding = useCallback(
    (l: Landing) => {
      // Guess the endpoints from the track so the prompt is pre-filled, then
      // persist the flight — v1's _nearestAirport + _pushLiveFlight.
      void (async () => {
        const db = await loadAirportDb();
        const table = Object.fromEntries(
          Object.entries(db).map(([k, v]) => [k, { lat: v.lat, lon: v.lon }]),
        );
        const first = l.track[0];
        const last = l.track[l.track.length - 1];
        const from = nearestAirport(first.lat, first.lon, table) ?? "";
        const to = nearestAirport(last.lat, last.lon, table) ?? "";
        setForm({ from, to, notes: `ADS-B · max ${l.maxAlt.toLocaleString()} ft` });
        if (aircraftId) {
          await pushLiveFlight({
            reg, aircraftId, track: l.track, maxAlt: l.maxAlt,
            durationH: l.durationH, depCode: from || null, arrCode: to || null,
          });
        }
      })();
      setLanding(l);
    },
    [reg, aircraftId],
  );

  const { state, status } = useLivePosition(reg, save ? onLanding : undefined);

  async function logIt() {
    if (!landing || !data || !save) return;
    const entry: FlightEntry = {
      date: today(),
      from: form.from.trim().toUpperCase() || undefined,
      to: form.to.trim().toUpperCase() || undefined,
      dur: Number(landing.durationH.toFixed(1)),
      notes: form.notes.trim() || undefined,
    };
    const routes = (data.flightRoutes ?? []) as RouteEntry[];
    const next: V1Aircraft = {
      ...data,
      flights: [entry, ...((data.flights ?? []) as FlightEntry[])],
      flightRoutes:
        entry.from && entry.to
          ? [...routes, { from: entry.from, to: entry.to, date: entry.date, reg }]
          : routes,
    };
    await save(next);
    setLanding(null);
    toast("Flight logged from ADS-B", "ok");
  }

  const banner = (() => {
    if (status === "searching") {
      return (
        <div className="adsb-banner searching">
          <span className="adsb-banner-icon"><Icon name="signal" size={17} /></span>
          <div className="adsb-banner-main">
            <div className="adsb-banner-title">Searching for {reg}…</div>
            <div className="adsb-banner-detail">Checking live ADS-B feed</div>
          </div>
        </div>
      );
    }

    if (status === "error") {
      return (
        <div className="adsb-banner ground">
          <span className="adsb-banner-icon"><Icon name="signal" size={17} /></span>
          <div className="adsb-banner-main">
            <div className="adsb-banner-title">Live tracking unavailable</div>
            <div className="adsb-banner-detail">
              Couldn&rsquo;t reach the ADS-B feed — this says nothing about whether{" "}
              {reg} is flying
            </div>
          </div>
        </div>
      );
    }

    if (status === "none") {
      return (
        <div className="adsb-banner ground">
          <span className="adsb-banner-icon"><Icon name="landing" size={17} /></span>
          <div className="adsb-banner-main">
            <div className="adsb-banner-title">{reg} — no live signal</div>
            <div className="adsb-banner-detail">Not currently broadcasting ADS-B</div>
          </div>
        </div>
      );
    }

    if (status === "ground") {
      return (
        <div className="adsb-banner ground">
          <span className="adsb-pulse ground" />
          <div className="adsb-banner-main">
            <div className="adsb-banner-title">{reg} — On Ground</div>
            <div className="adsb-banner-detail">
              {state?.callsign ? `${state.callsign} · ` : ""}Parked or taxiing
            </div>
          </div>
        </div>
      );
    }

    return (
      <div className="adsb-banner">
        <span className="adsb-pulse" />
        <div className="adsb-banner-main">
          <div className="adsb-banner-title">{reg} — Airborne</div>
          <div className="adsb-banner-detail">
            {state?.callsign ? `${state.callsign} · ` : ""}live ADS-B
          </div>
        </div>
        <div className="adsb-banner-chips">
          {state?.alt != null && <Stat label="Altitude" value={`${state.alt.toLocaleString()} ft`} />}
          {state?.gspd != null && <Stat label="Ground Spd" value={`${Math.round(state.gspd)} kt`} />}
          {state?.track != null && <Stat label="Heading" value={`${Math.round(state.track)}°`} />}
          {state?.vspd != null && <Stat label="V/S" value={`${state.vspd > 0 ? "+" : ""}${state.vspd} fpm`} />}
          {state?.squawk && <Stat label="Squawk" value={state.squawk} />}
        </div>
      </div>
    );
  })();

  return (
    <>
      {banner}
      {status === "airborne" && state && <AdsbPanel reg={reg} state={state} />}

      {landing && (
        <Modal title={`${reg} has landed`} onClose={() => setLanding(null)}>
          <div className="how-box">
            Tracked <b>{landing.durationH.toFixed(1)} hrs</b> airborne, max altitude{" "}
            <b>{landing.maxAlt.toLocaleString()} ft</b>, {landing.track.length} position fixes.
            Log it to the flight log?
          </div>
          <div className="form-grid">
            <div className="form-row">
              <label>From</label>
              <input value={form.from} onChange={(e) => setForm((f) => ({ ...f, from: e.target.value }))} placeholder="KVDF" />
            </div>
            <div className="form-row">
              <label>To</label>
              <input value={form.to} onChange={(e) => setForm((f) => ({ ...f, to: e.target.value }))} placeholder="KPCM" />
            </div>
          </div>
          <div className="form-row">
            <label>Notes</label>
            <input value={form.notes} onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))} />
          </div>
          <div className="form-actions">
            <button className="btn-cancel" onClick={() => setLanding(null)}>Not now</button>
            <button className="btn-save" onClick={logIt}>Log Flight</button>
          </div>
        </Modal>
      )}
    </>
  );
}
