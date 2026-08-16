"use client";

/**
 * Grants this tab removed itself, so the realtime echo doesn't misreport them.
 *
 * Revoking someone and their declining you are the same DELETE on the wire.
 * v1 kept a `_revokedByUs` id for exactly this, otherwise revoking a person
 * immediately told you they'd declined. Same trick, scoped to ids rather than
 * one at a time.
 *
 * Ids are dropped after a minute — long enough for the round trip, short
 * enough that a genuine later decline of a re-issued invite isn't swallowed.
 */
const selfInitiated = new Map<string, number>();
const TTL_MS = 60_000;

export function markSelfInitiated(id: string) {
  selfInitiated.set(id, Date.now() + TTL_MS);
}

export function wasSelfInitiated(id: string): boolean {
  const until = selfInitiated.get(id);
  if (until === undefined) return false;
  selfInitiated.delete(id);
  return until > Date.now();
}
