"use client";

import { useLivePosition } from "@/lib/adsb";

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <span className="adsb-stat">
      <span className="adsb-stat-val">{value}</span>
      <span className="adsb-stat-lbl">{label}</span>
    </span>
  );
}

// Live ADS-B banner shown under the hero. Polls adsb.lol every 10s.
export function LiveBanner({ reg }: { reg: string }) {
  const { state, status } = useLivePosition(reg);

  if (status === "searching") {
    return (
      <div className="adsb-banner searching">
        <span className="adsb-banner-icon">📡</span>
        <div className="adsb-banner-main">
          <div className="adsb-banner-title">Searching for {reg}…</div>
          <div className="adsb-banner-detail">Checking live ADS-B feed</div>
        </div>
      </div>
    );
  }

  if (status === "none") {
    return (
      <div className="adsb-banner ground">
        <span className="adsb-banner-icon">🛬</span>
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
            {state?.callsign ? `${state.callsign} · ` : ""}
            Parked or taxiing
          </div>
        </div>
      </div>
    );
  }

  // airborne
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
}
