"use client";

import { useEffect, useState } from "react";

// v1 offered Dark / Light / System and eight accents, storing the accent by
// NAME ('blue'). The first port dropped System, shipped six accents and stored
// raw hex — so an existing at_accent value no longer resolved.
type Theme = "dark" | "light" | "system";

// Five accents, none of which can be mistaken for a status. The status
// colours own green (current), amber (due soon) and red (overdue), so an
// accent in any of those bands made a highlighted control read as a state:
// green, mint, red and amber are gone. Slate was too close to muted text to
// read as an accent at all, and mint duplicated green. What is left is
// distinct from the status set and from each other, and each is saturated
// enough to carry a button.
const ACCENTS: [string, string][] = [
  ["blue", "#3b9eff"],
  ["cyan", "#22d3ee"],
  ["violet", "#8b5cf6"],
  ["magenta", "#ec4899"],
  ["silver", "#e2e8f0"],
];

// Accents that existed before, mapped to the nearest survivor so a stored
// preference still resolves.
const LEGACY: Record<string, string> = {
  green: "cyan", mint: "cyan", purple: "violet", red: "magenta", amber: "magenta", slate: "silver",
};

const hexOf = (name: string) =>
  ACCENTS.find(([n]) => n === (LEGACY[name] ?? name))?.[1] ??
  (name.startsWith("#") ? name : ACCENTS[0][1]);

export function ThemeControls() {
  // `null` until mounted — the DOM/localStorage are the source of truth and are
  // only readable on the client, so the first paint defers to the inline script
  // in layout.tsx rather than guessing.
  const [theme, setTheme] = useState<Theme | null>(null);
  const [accent, setAccent] = useState<string | null>(null);

  // Must be an effect, not a lazy initializer: this renders on the server too,
  // where localStorage does not exist, so reading it during render would cause
  // a hydration mismatch. One post-mount sync is the intended trade.
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setTheme((localStorage.getItem("at_theme") as Theme) ?? "dark");
    const stored = localStorage.getItem("at_accent") ?? "blue";
    setAccent(LEGACY[stored] ?? stored);
  }, []);

  function applyTheme(next: Theme) {
    setTheme(next);
    localStorage.setItem("at_theme", next);
    const dark =
      next === "dark" ||
      (next === "system" &&
        !window.matchMedia("(prefers-color-scheme: light)").matches);
    document.documentElement.classList.toggle("light", !dark);
  }

  function applyAccent(name: string) {
    setAccent(name);
    localStorage.setItem("at_accent", name);
    const hex = hexOf(name);
    const r = document.documentElement.style;
    r.setProperty("--accent", hex);
    r.setProperty("--accent-dim", hex + "1a");
  }

  return (
    <div className="panel">
      <div className="panel-title">Appearance</div>

      <div
        className="ins-field"
        style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}
      >
        <span className="ins-field-value">Theme</span>
        <div className="seg">
          {(["dark", "light", "system"] as Theme[]).map((t) => (
            <button key={t} className={theme === t ? "on" : ""} onClick={() => applyTheme(t)}>
              {t[0].toUpperCase() + t.slice(1)}
            </button>
          ))}
        </div>
      </div>

      <div
        className="ins-field"
        style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}
      >
        <span className="ins-field-value">Accent</span>
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
          {ACCENTS.map(([name, hex]) => (
            <span
              key={name}
              className={`accent-swatch ${accent === name ? "active" : ""}`}
              style={{ "--sw": hex } as React.CSSProperties}
              onClick={() => applyAccent(name)}
              role="button"
              aria-label={`Accent ${name}`}
              title={name}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
