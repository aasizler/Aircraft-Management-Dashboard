"use client";

import * as DropdownMenu from "@radix-ui/react-dropdown-menu";
import type { ReactNode } from "react";
import { Icon, type IconName } from "./icon";

export type { IconName };

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

/**
 * Non-modal on purpose. Radix's default (modal) traps focus and manages
 * `pointer-events` on <body> for the duration — and because selecting an item
 * opens one of our own modals on top, its teardown overlapped with that mount.
 * The result: after closing the dialog, the FIRST click on any ⋮ was swallowed
 * and you had to click twice. These are dropdowns, not blocking dialogs;
 * nothing here wants a focus trap.
 */
export function Menu({ children }: { children: ReactNode }) {
  return <DropdownMenu.Root modal={false}>{children}</DropdownMenu.Root>;
}
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
