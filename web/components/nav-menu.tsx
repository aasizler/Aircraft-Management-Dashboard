"use client";

import { useEffect, useRef, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

/**
 * Nav ⋮ menu, ported from v1's toggleDotMenu()/closeDotMenus(). v1 showed
 * "Aircraft Settings / App Settings / Sign Out" on the detail view and
 * "Rearrange Hangar / Settings / Sign Out" on the hangar; the first port had no
 * nav menu at all, exposing Sign Out as a bare button instead.
 */
export function NavMenu({ email }: { email?: string | null }) {
  const [open, setOpen] = useState(false);
  const wrap = useRef<HTMLDivElement>(null);
  const router = useRouter();
  const pathname = usePathname();
  const onDetail = pathname?.startsWith("/aircraft/");

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (!wrap.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("mousedown", onDoc);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDoc);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  async function signOut() {
    await createClient().auth.signOut();
    router.push("/login");
    router.refresh();
  }

  return (
    <div className="nav-right" ref={wrap} style={{ position: "relative" }}>
      {onDetail && (
        <button className="btn primary sm" onClick={() => router.push("/")}>
          Hangar
        </button>
      )}
      <button
        className="dot-menu-btn"
        aria-label="Menu"
        onClick={() => setOpen((o) => !o)}
      >
        <span /><span /><span />
      </button>

      {open && (
        <div className="dot-menu">
          {onDetail && (
            <button
              className="dot-menu-item"
              onClick={() => {
                setOpen(false);
                // The settings modal lives inside AircraftDetailClient; v1 called
                // openSettingsModal() directly, so bridge with an event.
                window.dispatchEvent(new Event("aerotrack:aircraft-settings"));
              }}
            >
              Aircraft Settings
            </button>
          )}
          {/* No Manage Access here. v1's detail menu was Aircraft Settings /
              App Settings / Sign Out; this item was added in the port, and the
              nav has no idea what role the viewer holds — so for anyone who
              can't manage access it dispatched an event that nothing was
              listening for and the menu just closed. The detail page renders
              its own Manage Access button behind can(role,'manage_access'),
              and the hangar tile menu gates the same way. */}
          {!onDetail && (
            <button
              className="dot-menu-item"
              onClick={() => {
                setOpen(false);
                window.dispatchEvent(new Event("aerotrack:rearrange"));
              }}
            >
              Rearrange Hangar
            </button>
          )}
          <button
            className="dot-menu-item"
            onClick={() => { setOpen(false); router.push("/settings"); }}
          >
            {onDetail ? "App Settings" : "Settings"}
          </button>
          {email && (
            <div
              className="dot-menu-item"
              style={{ color: "var(--muted)", fontSize: 11, cursor: "default", borderTop: "1px solid var(--border2)" }}
            >
              {email}
            </div>
          )}
          <button
            className="dot-menu-item"
            style={{ color: "var(--danger)" }}
            onClick={() => { setOpen(false); signOut(); }}
          >
            Sign Out
          </button>
        </div>
      )}
    </div>
  );
}
