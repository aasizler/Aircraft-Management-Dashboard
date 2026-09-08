"use client";

import { useMemo, useState } from "react";
import { modsFor, modById, type AcClass, type Mod, type ModKind } from "@/lib/reference-data";

const KIND: Record<ModKind, string> = {
  engine: "Engine",
  prop: "Prop",
  airframe: "Airframe",
};

/**
 * The STC modifications fitted to the airframe, ForeFlight-style: the common
 * ones for the type as toggles, plus a line for anything we don't list. An
 * engine conversion hands its engine up so the form can re-point Engine Type.
 */
export function ModsPicker({
  typeName,
  cls,
  value,
  onChange,
  onEngine,
}: {
  typeName: string;
  cls: AcClass;
  value: string[];
  onChange: (next: string[]) => void;
  onEngine?: (engine: string) => void;
}) {
  const [other, setOther] = useState("");
  const offered = useMemo(() => modsFor(typeName, cls), [typeName, cls]);
  // Anything stored that the type no longer offers (or that was typed in)
  // still shows, so a fitted mod never silently disappears from the profile.
  const extra = value.filter((id) => !offered.some((m) => m.id === id));

  function toggle(m: Mod) {
    const on = value.includes(m.id);
    onChange(on ? value.filter((x) => x !== m.id) : [...value, m.id]);
    if (!on && m.eng && onEngine) onEngine(m.eng);
  }
  function addOther() {
    const t = other.trim();
    if (!t || value.includes(t)) return;
    onChange([...value, t]);
    setOther("");
  }

  if (!offered.length && !extra.length && !typeName.trim()) return null;

  return (
    <div className="form-row">
      <label>Modifications</label>
      <div className="mod-chips">
        {offered.map((m) => {
          const on = value.includes(m.id);
          return (
            <button
              key={m.id}
              type="button"
              className={`mod-chip${on ? " on" : ""}`}
              title={[m.holder, m.note].filter(Boolean).join(" — ")}
              onClick={() => toggle(m)}
              aria-pressed={on}
            >
              <span className="mod-kind">{KIND[m.kind]}</span>
              {m.name}
            </button>
          );
        })}
        {extra.map((id) => (
          <button
            key={id}
            type="button"
            className="mod-chip on"
            onClick={() => onChange(value.filter((x) => x !== id))}
            aria-pressed
          >
            <span className="mod-kind">{modById(id) ? KIND[modById(id)!.kind] : "Other"}</span>
            {modById(id)?.name ?? id}
          </button>
        ))}
      </div>
      <div className="mod-other">
        <input
          value={other}
          onChange={(e) => setOther(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addOther(); } }}
          placeholder="Another STC or mod — type it and press Enter"
        />
      </div>
    </div>
  );
}
