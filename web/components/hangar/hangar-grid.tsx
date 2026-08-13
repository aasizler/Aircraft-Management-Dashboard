"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

type Tile = {
  id: string;
  reg: string;
  type: string | null;
  serial: string | null;
  airport: string | null;
};

export function HangarGrid({ aircraft }: { aircraft: Tile[] }) {
  const router = useRouter();
  const [menu, setMenu] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function archive(id: string) {
    setBusy(true);
    await createClient().from("aircraft").update({ archived: true }).eq("id", id);
    setBusy(false);
    setMenu(null);
    router.refresh();
  }

  return (
    <div className="ac-cards">
      {aircraft.map((a) => (
        <div key={a.id} className="ac-tile" style={{ cursor: "default" }}>
          <button
            className="tile-dot-btn"
            style={{ position: "absolute", top: 10, right: 10 }}
            onClick={(e) => {
              e.preventDefault();
              setMenu(menu === a.id ? null : a.id);
            }}
          >
            <span /><span /><span />
          </button>
          {menu === a.id && (
            <div className="tile-dot-menu open" style={{ top: 40, right: 10, position: "absolute" }}>
              <button className="portal-item" disabled={busy} onClick={() => archive(a.id)}>
                Archive aircraft
              </button>
            </div>
          )}

          <Link href={`/aircraft/${a.id}`} style={{ textDecoration: "none", color: "inherit" }}>
            <div className="ac-tile-top">
              <span className="ac-tile-pro">AIRCRAFT</span>
              <span style={{ fontSize: 30, opacity: 0.5 }}>✈</span>
            </div>
            <div className="ac-tile-body">
              <div className="ac-tile-reg">{a.reg}</div>
              <div className="ac-tile-type">{a.type ?? "—"}</div>
              <div className="ac-tile-serial">{a.serial ? `S/N ${a.serial}` : ""}</div>
            </div>
            <div className="ac-tile-foot">
              <span className="mono">{a.airport ?? "—"}</span>
            </div>
          </Link>
        </div>
      ))}
    </div>
  );
}
