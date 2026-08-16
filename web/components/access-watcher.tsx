"use client";

import { useAccessRealtime } from "@/lib/realtime";

/**
 * Watches access grants for the whole signed-in session, mounted once in the
 * root layout so it covers every authenticated page.
 *
 * It used to live only in the hangar grid, which meant a revocation that landed
 * while someone was reading an aircraft page went unnoticed until they
 * navigated away — the stale-view case v1 handled in checkOfflineRevocations().
 * RLS still refuses their writes, so this is about not showing someone a page
 * they no longer have rights to, rather than about blocking access.
 *
 * Renders nothing; it exists purely for the subscription's lifetime.
 */
export function AccessWatcher() {
  useAccessRealtime();
  return null;
}
