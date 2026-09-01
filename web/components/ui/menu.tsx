"use client";

import * as DropdownMenu from "@radix-ui/react-dropdown-menu";
import type { ReactNode } from "react";

/**
 * The app's ⋮ menus, on Radix's dropdown-menu primitive.
 *
 * These were hand-rolled divs with a document mousedown listener, and the
 * seams showed: a fleet menu closed on its OWN mousedown and unmounted before
 * the click landed, so its buttons did nothing; and every menu wrapper carried
 * the same z-index, so one fleet's menu rendered on top of another's. Both are
 * structurally impossible here — Radix portals the content, manages focus and
 * dismissal, and handles collision. Escape, arrow keys, typeahead and the
 * correct ARIA roles come with it.
 *
 * Shape follows the convention every dense tool uses (Linear, Vercel, Stripe):
 * an identity or context header that is NOT an action, then grouped items with
 * icons, then destructive actions separated below a divider.
 */

export const Menu = DropdownMenu.Root;
export const MenuTrigger = DropdownMenu.Trigger;

export function MenuContent({
  children,
  align = "end",
  ariaLabel,
}: {
  children: ReactNode;
  align?: "start" | "center" | "end";
  ariaLabel?: string;
}) {
  return (
    <DropdownMenu.Portal>
      <DropdownMenu.Content
        className="menu"
        align={align}
        sideOffset={6}
        collisionPadding={10}
        aria-label={ariaLabel}
        // The content is portaled out of the tile in the DOM, but React
        // synthetic events bubble through the REACT tree, not the DOM one — so
        // a click on "Manage access" still reached the tile's onClick and
        // navigated to the aircraft underneath. Stop it at the menu boundary.
        // These fire after the item's own handlers, so selection is unaffected.
        onClick={(e) => e.stopPropagation()}
        onPointerDown={(e) => e.stopPropagation()}
      >
        {children}
      </DropdownMenu.Content>
    </DropdownMenu.Portal>
  );
}

/**
 * Who you are — a header, not a row. Rendering the account email as another
 * item was the single loudest "unfinished" tell in the old menus: identity
 * styled exactly like Sign out, but not clickable.
 */
export function MenuIdentity({ name, sub }: { name: string; sub?: string | null }) {
  const initials =
    name
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((w) => w[0]?.toUpperCase())
      .join("") || "?";
  return (
    <div className="menu-identity">
      <span className="menu-avatar">{initials}</span>
      <span className="menu-identity-text">
        <span className="menu-identity-name">{name}</span>
        {sub && <span className="menu-identity-sub">{sub}</span>}
      </span>
    </div>
  );
}

/** Names what the menu is acting on — "N137BF", "Main fleet". */
export function MenuLabel({ children }: { children: ReactNode }) {
  return <DropdownMenu.Label className="menu-label">{children}</DropdownMenu.Label>;
}

export function MenuSeparator() {
  return <DropdownMenu.Separator className="menu-sep" />;
}

export function MenuItem({
  children,
  onSelect,
  icon,
  danger,
}: {
  children: ReactNode;
  onSelect: () => void;
  icon?: IconName;
  danger?: boolean;
}) {
  return (
    <DropdownMenu.Item
      className={`menu-item${danger ? " danger" : ""}`}
      onSelect={onSelect}
    >
      {icon && <Icon name={icon} />}
      <span>{children}</span>
    </DropdownMenu.Item>
  );
}

// A handful of 16px strokes, inline rather than a dependency. A menu without
// icons reads as a debug list; a whole icon package for nine glyphs does not
// earn its bundle.
export type IconName =
  | "sort" | "settings" | "logout" | "users" | "eye"
  | "trash" | "share" | "pencil" | "inbox" | "exit";

const PATHS: Record<IconName, string> = {
  sort:     "M4 6h10M4 12h7M4 18h4M17 8v10m0 0l-3-3m3 3l3-3",
  settings: "M12 15a3 3 0 100-6 3 3 0 000 6zM19.4 15a1.7 1.7 0 00.3 1.9l.1.1a2 2 0 11-2.8 2.8l-.1-.1a1.7 1.7 0 00-2.9 1.2v.2a2 2 0 11-4 0v-.1a1.7 1.7 0 00-1.1-1.6 1.7 1.7 0 00-1.9.4l-.1.1a2 2 0 11-2.8-2.8l.1-.1a1.7 1.7 0 00-1.2-2.9h-.2a2 2 0 110-4h.1a1.7 1.7 0 001.6-1.1 1.7 1.7 0 00-.4-1.9l-.1-.1a2 2 0 112.8-2.8l.1.1a1.7 1.7 0 001.9.3h.1A1.7 1.7 0 0011 3.5v-.2a2 2 0 114 0v.1a1.7 1.7 0 001 1.6 1.7 1.7 0 001.9-.4l.1-.1a2 2 0 112.8 2.8l-.1.1a1.7 1.7 0 00-.3 1.9v.1a1.7 1.7 0 001.6 1H21a2 2 0 010 4h-.1a1.7 1.7 0 00-1.5 1z",
  logout:   "M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4M16 17l5-5-5-5M21 12H9",
  users:    "M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2M9 11a4 4 0 100-8 4 4 0 000 8zM23 21v-2a4 4 0 00-3-3.9M16 3.1a4 4 0 010 7.8",
  eye:      "M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8zM12 15a3 3 0 100-6 3 3 0 000 6z",
  trash:    "M3 6h18M8 6V4a1 1 0 011-1h6a1 1 0 011 1v2m3 0v14a1 1 0 01-1 1H6a1 1 0 01-1-1V6",
  share:    "M4 12v8a1 1 0 001 1h14a1 1 0 001-1v-8M16 6l-4-4-4 4M12 2v14",
  pencil:   "M17 3a2.8 2.8 0 114 4L7.5 20.5 2 22l1.5-5.5L17 3z",
  inbox:    "M22 12h-6l-2 3h-4l-2-3H2M5.5 5.1L2 12v6a2 2 0 002 2h16a2 2 0 002-2v-6l-3.5-6.9A2 2 0 0016.8 4H7.2a2 2 0 00-1.7 1.1z",
  exit:     "M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4M16 17l5-5-5-5M21 12H9",
};

function Icon({ name }: { name: IconName }) {
  return (
    <svg
      className="menu-icon"
      viewBox="0 0 24 24"
      width="15"
      height="15"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d={PATHS[name]} />
    </svg>
  );
}
