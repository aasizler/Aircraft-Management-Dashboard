"use client";

import {
  Menu, MenuTrigger, MenuContent, MenuItem, MenuSeparator, MenuLabel,
  type IconName,
} from "@/components/ui/menu";

export type RowMenuItem = {
  label: string;
  onClick: () => void;
  danger?: boolean;
  icon?: IconName;
};

/**
 * The ⋮ that sits at the end of a table row — inspections, squawks, flights,
 * schedule.
 *
 * Same `items` API it always had, now on the shared Radix menu so these behave
 * identically to the hangar's: portalled out of the row (a menu inside an
 * overflow-scrolled table used to be clipped by it), keyboard navigable, and
 * dismissed by the same rules everywhere.
 */
export function RowMenu({
  items,
  label,
}: {
  items: RowMenuItem[];
  /** Names the row being acted on, when "Delete row" alone would be ambiguous. */
  label?: string;
}) {
  const firstDanger = items.findIndex((i) => i.danger);

  return (
    <Menu>
      <MenuTrigger asChild>
        <button className="row-dot-btn" title="More" aria-label={label ? `Actions for ${label}` : "More actions"}>
          <span /><span /><span />
        </button>
      </MenuTrigger>
      <MenuContent>
        {label && <MenuLabel>{label}</MenuLabel>}
        {items.map((it, i) => (
          <span key={it.label} style={{ display: "contents" }}>
            {/* Destructive actions get separated rather than relying on colour
                alone — the same rule the hangar menus follow. */}
            {i === firstDanger && i > 0 && <MenuSeparator />}
            <MenuItem icon={it.icon ?? inferIcon(it.label)} danger={it.danger} onSelect={it.onClick}>
              {it.label}
            </MenuItem>
          </span>
        ))}
      </MenuContent>
    </Menu>
  );
}

// Every row menu in the app draws from the same short vocabulary, so the icon
// follows from the verb and no call site has to restate it. An explicit `icon`
// still wins for anything new.
function inferIcon(label: string): IconName | undefined {
  const l = label.toLowerCase();
  if (l.startsWith("edit")) return "pencil";
  if (l.startsWith("delete")) return "trash";
  if (l.startsWith("clear")) return "eraser";
  if (l.startsWith("deactivate") || l.startsWith("reactivate")) return "power";
  if (l.startsWith("view")) return "eye";
  return undefined;
}
