"use client";

/**
 * What the current viewer may do with the aircraft currently on screen.
 *
 * The nav ⋮ menu lives in the root layout and has no idea which aircraft is
 * open or what role the viewer holds there, so it was offering "Aircraft
 * Settings" to everyone — including pilots and mechanics, whose role has no
 * edit_settings. The item dispatched its event, the detail page had no modal
 * mounted to receive it, and the menu simply closed.
 *
 * A plain event doesn't fix that reliably: the publisher and the subscriber
 * mount in the same commit, so whether the announcement is heard depends on
 * effect ordering between a layout child and a page child. A store the nav
 * reads on demand has no such race — if the detail page published before the
 * nav subscribed, the snapshot is already there.
 *
 * Null means "no aircraft open", which is also the correct answer on the
 * hangar and during SSR.
 */
export type AircraftPerms = {
  editSettings: boolean;
  manageAccess: boolean;
} | null;

let current: AircraftPerms = null;
const subscribers = new Set<() => void>();

/** Publish (or, with null, retract) the open aircraft's permissions. */
export function setAircraftPerms(next: AircraftPerms) {
  // Identity matters: useSyncExternalStore compares snapshots by reference and
  // will loop if a fresh object is handed back for an unchanged value.
  if (
    current === next ||
    (current &&
      next &&
      current.editSettings === next.editSettings &&
      current.manageAccess === next.manageAccess)
  ) {
    return;
  }
  current = next;
  subscribers.forEach((fn) => fn());
}

export function subscribeAircraftPerms(fn: () => void) {
  subscribers.add(fn);
  return () => {
    subscribers.delete(fn);
  };
}

export function getAircraftPerms(): AircraftPerms {
  return current;
}

/** Server render has no open aircraft; keeps hydration from mismatching. */
export function getServerAircraftPerms(): AircraftPerms {
  return null;
}
