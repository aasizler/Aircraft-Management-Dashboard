"use client";

import { useSyncExternalStore } from "react";
import { usePathname, useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Icon } from "@/components/ui/icon";
import {
  Menu, MenuTrigger, MenuContent, MenuItem, MenuSeparator, MenuIdentity,
} from "@/components/ui/menu";
import {
  getAircraftPerms,
  getPendingInvites,
  getServerAircraftPerms,
  getServerPendingInvites,
  subscribeAircraftPerms,
  subscribePendingInvites,
} from "@/lib/aircraft-perms";

/**
 * Nav ⋮ menu, ported from v1's toggleDotMenu()/closeDotMenus(). v1 showed
 * "Aircraft Settings / App Settings / Sign Out" on the detail view and
 * "Rearrange Hangar / Settings / Sign Out" on the hangar; the first port had no
 * nav menu at all, exposing Sign Out as a bare button instead.
 */
export function NavMenu({ email, name }: { email?: string | null; name?: string | null }) {
  const router = useRouter();
  const pathname = usePathname();
  const onDetail = pathname?.startsWith("/aircraft/");

  // Published by the open aircraft's detail page. Null on the hangar and
  // during SSR, so the aircraft-scoped items simply don't render there.
  const perms = useSyncExternalStore(
    subscribeAircraftPerms,
    getAircraftPerms,
    getServerAircraftPerms,
  );

  const pending = useSyncExternalStore(
    subscribePendingInvites,
    getPendingInvites,
    getServerPendingInvites,
  );

  async function signOut() {
    await createClient().auth.signOut();
    router.push("/login");
    router.refresh();
  }

  return (
    <div className="nav-right">
      {/* The way back out of an aircraft, so it carries the ribbon's weight
          rather than the dense-row height every other sm button uses. */}
      {onDetail && (
        <button className="btn primary nav-back" onClick={() => router.push("/")}>
          <Icon name="hangar" size={16} />
          Hangar
        </button>
      )}

      <Menu>
        <MenuTrigger asChild>
          <button className="dot-ghost" aria-label="Menu">
            <span /><span /><span />
          </button>
        </MenuTrigger>

        <MenuContent ariaLabel="Account and page actions">
          {/* Who you are, as a header. This was previously a row styled like
              Sign out but not clickable. */}
          <MenuIdentity name={name?.trim() || email || "Signed in"} sub={name?.trim() ? email : null} />
          <MenuSeparator />

          {/* Only when something is waiting. The ribbon can be dismissed and
              the toast expires, so without this an invitation could not be
              reached again until a reload. */}
          {pending > 0 && (
            <MenuItem
              icon="inbox"
              onSelect={() => window.dispatchEvent(new Event("aerotrack:pending-invites"))}
            >
              Pending invitations ({pending})
            </MenuItem>
          )}

          {onDetail && perms?.editSettings && (
            <MenuItem
              icon="settings"
              onSelect={() => window.dispatchEvent(new Event("aerotrack:aircraft-settings"))}
            >
              Aircraft settings
            </MenuItem>
          )}

          {/* No Manage access here. v1's detail menu was Aircraft Settings /
              App Settings / Sign Out; this item was added in the port, and the
              nav has no idea what role the viewer holds — so for anyone who
              can't manage access it dispatched an event that nothing was
              listening for and the menu just closed. */}
          {!onDetail && (
            <MenuItem
              icon="sort"
              onSelect={() => window.dispatchEvent(new Event("aerotrack:rearrange"))}
            >
              Rearrange hangar
            </MenuItem>
          )}

          <MenuItem icon="settings" onSelect={() => router.push("/settings")}>
            {onDetail ? "App settings" : "Settings"}
          </MenuItem>

          <MenuSeparator />
          <MenuItem icon="logout" danger onSelect={signOut}>Sign out</MenuItem>
        </MenuContent>
      </Menu>
    </div>
  );
}
