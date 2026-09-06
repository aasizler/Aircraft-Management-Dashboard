"use client";

import type { LiveState } from "@/lib/adsb";

/**
 * Floating live-telemetry panel, ported from v1's _getOrCreateAdsbPanel /
 * _fillAdsbPanel / _openAdsbPopup. Shown only while the aircraft is airborne.
 */
export function AdsbPanel({
  reg, state, open, onOpen, onClose,
}: {
  reg: string; state: LiveState; open: boolean; onOpen: () => void; onClose: () => void;
}) {
  if (!open) {
    return (
      <button className="adsb-panel-reopen" onClick={onOpen}>
        <span className="adsb-pulse" /> {reg} live
      </button>
    );
  }

  const rows: [string, string][] = [
    ["Altitude", state.alt != null ? `${state.alt.toLocaleString()} ft` : "—"],
    ["Ground speed", state.gspd != null ? `${Math.round(state.gspd)} kt` : "—"],
    ["Heading", state.track != null ? `${Math.round(state.track)}°` : "—"],
    ["Vertical speed", state.vspd != null ? `${state.vspd > 0 ? "+" : ""}${state.vspd} fpm` : "—"],
    ["Squawk", state.squawk ?? "—"],
    ["Callsign", state.callsign ?? "—"],
    [
      "Position",
      state.lat != null && state.lon != null
        ? `${state.lat.toFixed(3)}, ${state.lon.toFixed(3)}`
        : "—",
    ],
  ];

  return (
    <div className="adsb-panel">
      <div className="adsb-panel-hd">
        <span className="adsb-pulse" />
        <span className="adsb-panel-reg">{reg}</span>
        <button className="adsb-panel-x" onClick={onClose} aria-label="Hide panel">
          ×
        </button>
      </div>
      {rows.map(([k, v]) => (
        <div className="adsb-row" key={k}>
          <span className="adsb-row-k">{k}</span>
          <span className="adsb-row-v">{v}</span>
        </div>
      ))}
    </div>
  );
}
