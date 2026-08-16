"use client";

import { useEffect, useRef, useState } from "react";
import { AIRCRAFT_DB, AP_FULL, ENGINE_DB, type Engine } from "@/lib/reference-data";

type Item = { key: string; code: string; label: string; value: string };

/** Shared combobox — ports acType/acAirport/acEngine + acKey/acHover/acPick. */
function Combo({
  value,
  onChange,
  onPick,
  placeholder,
  search,
  id,
}: {
  value: string;
  onChange: (v: string) => void;
  onPick?: (item: Item) => void;
  placeholder?: string;
  search: (q: string) => Item[];
  id?: string;
}) {
  const [open, setOpen] = useState(false);
  const [hi, setHi] = useState(-1);
  const [items, setItems] = useState<Item[]>([]);
  const wrap = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (!wrap.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [open]);

  function run(q: string) {
    const next = q.trim() ? search(q) : [];
    setItems(next);
    setHi(-1);
    setOpen(next.length > 0);
  }

  function choose(it: Item) {
    onChange(it.value);
    onPick?.(it);
    setOpen(false);
  }

  return (
    <div className="ac-wrap" ref={wrap}>
      <input
        id={id}
        value={value}
        placeholder={placeholder}
        autoComplete="off"
        onChange={(e) => {
          onChange(e.target.value);
          run(e.target.value);
        }}
        onFocus={() => value.trim() && run(value)}
        onKeyDown={(e) => {
          if (!open || !items.length) return;
          if (e.key === "ArrowDown") { e.preventDefault(); setHi((h) => (h + 1) % items.length); }
          else if (e.key === "ArrowUp") { e.preventDefault(); setHi((h) => (h - 1 + items.length) % items.length); }
          else if (e.key === "Enter" && hi >= 0) { e.preventDefault(); choose(items[hi]); }
          else if (e.key === "Escape") setOpen(false);
        }}
      />
      {open && (
        <div className="ac-dropdown">
          {items.map((it, i) => (
            <div
              key={it.key}
              className={`ac-item${i === hi ? " hi" : ""}`}
              onMouseEnter={() => setHi(i)}
              onMouseDown={(e) => { e.preventDefault(); choose(it); }}
            >
              <span className="ac-code">{it.code}</span>
              <span className="ac-name">{it.label}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export function TypeAutocomplete({
  value, onChange,
}: { value: string; onChange: (v: string) => void }) {
  return (
    <Combo
      value={value}
      onChange={onChange}
      placeholder="Type name or ICAO code"
      search={(q) => {
        const u = q.toUpperCase();
        return AIRCRAFT_DB.filter(
          (a) =>
            a.icao.includes(u) ||
            a.model.toUpperCase().includes(u) ||
            a.mfr.toUpperCase().includes(u),
        )
          .slice(0, 10)
          .map((a) => ({
            key: a.icao + a.model,
            code: a.icao,
            label: `${a.mfr} ${a.model}`,
            value: `${a.mfr} ${a.model}`,
          }));
      }}
    />
  );
}

/** Resolves "KVDF" → "KVDF — Tampa Executive Airport", as v1 stored it. */
export function AirportAutocomplete({
  value, onChange,
}: { value: string; onChange: (v: string) => void }) {
  const code = (value || "").trim().toUpperCase().split(" ")[0];
  const resolved = AP_FULL[code];
  return (
    <>
      <Combo
        value={value}
        onChange={onChange}
        placeholder="ICAO code (e.g. KVDF)"
        search={(q) => {
          const u = q.toUpperCase();
          return Object.entries(AP_FULL)
            .filter(([c, n]) => c.includes(u) || n.toUpperCase().includes(u))
            .slice(0, 10)
            .map(([c, n]) => ({ key: c, code: c, label: n, value: `${c} — ${n}` }));
        }}
      />
      {resolved && !value.includes("—") && (
        <div className="airport-resolved">{code} — {resolved}</div>
      )}
    </>
  );
}

export function EngineAutocomplete({
  value, onChange, onResolve,
}: {
  value: string;
  onChange: (v: string) => void;
  onResolve?: (e: Engine) => void;
}) {
  const [info, setInfo] = useState<Engine | null>(null);
  return (
    <>
      <Combo
        value={value}
        onChange={onChange}
        placeholder="e.g. IO-550-B, PT6A-60A"
        search={(q) => {
          const u = q.toUpperCase();
          return ENGINE_DB.filter(
            (e) =>
              e.id.toUpperCase().includes(u) ||
              e.model.toUpperCase().includes(u) ||
              e.mfr.toUpperCase().includes(u) ||
              (e.app ?? "").toUpperCase().includes(u),
          )
            .slice(0, 10)
            .map((e) => ({
              key: e.id,
              code: e.model,
              label: `${e.mfr} · ${e.hp}hp · TBO ${e.tbo}`,
              value: e.model,
            }));
        }}
        onPick={(it) => {
          const e = ENGINE_DB.find((x) => x.id === it.key);
          if (e) { setInfo(e); onResolve?.(e); }
        }}
      />
      {info && (
        <div className="airport-resolved">
          {info.mfr} {info.model} · {info.hp} hp · TBO {info.tbo} hrs
        </div>
      )}
    </>
  );
}
