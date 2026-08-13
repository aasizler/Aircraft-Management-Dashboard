"use client";

import { useEffect, useState } from "react";

const ACCENTS = ["#3b9eff", "#2dd4a0", "#f59e0b", "#f04b4b", "#a855f7", "#ec4899"];

export function ThemeControls() {
  const [theme, setTheme] = useState<"dark" | "light">("dark");
  const [accent, setAccent] = useState<string>(ACCENTS[0]);

  // Read current state on mount (the layout init script already applied it).
  useEffect(() => {
    setTheme(document.documentElement.classList.contains("light") ? "light" : "dark");
    const a = localStorage.getItem("at_accent");
    if (a) setAccent(a);
  }, []);

  function applyTheme(next: "dark" | "light") {
    setTheme(next);
    document.documentElement.classList.toggle("light", next === "light");
    localStorage.setItem("at_theme", next);
  }

  function applyAccent(hex: string) {
    setAccent(hex);
    const r = document.documentElement.style;
    r.setProperty("--accent", hex);
    r.setProperty("--accent-dim", hex + "1a");
    localStorage.setItem("at_accent", hex);
  }

  return (
    <div className="panel">
      <div className="panel-title">Appearance</div>

      <div className="ins-field" style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
        <span className="ins-field-value">Theme</span>
        <div className="seg">
          <button className={theme === "dark" ? "on" : ""} onClick={() => applyTheme("dark")}>Dark</button>
          <button className={theme === "light" ? "on" : ""} onClick={() => applyTheme("light")}>Light</button>
        </div>
      </div>

      <div className="ins-field" style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
        <span className="ins-field-value">Accent</span>
        <div style={{ display: "flex", gap: 10 }}>
          {ACCENTS.map((hex) => (
            <span
              key={hex}
              className={`accent-swatch ${accent === hex ? "active" : ""}`}
              style={{ "--sw": hex } as React.CSSProperties}
              onClick={() => applyAccent(hex)}
              role="button"
              aria-label={`Accent ${hex}`}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
