"use client";

import { useCallback, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

/**
 * Live sync, ported from v1's initRealtime() / handleRealtimeFleetUpdate() /
 * handleRealtimeSharesUpdate() / checkOfflineRevocations().
 *
 * v1 subscribed to the `fleet` blob and to `aircraft_shares`. v2's equivalents
 * are the per-aircraft `aircraft` rows and `aircraft_access`. Without this, two
 * managers editing the same aircraft don't see each other's changes until a
 * manual reload.
 */

/** Watches one aircraft row; calls onRemote when someone else changes it. */
export function useAircraftRealtime(
  aircraftId: string,
  onRemote: (data: Record<string, unknown>) => void,
) {
  useEffect(() => {
    if (!aircraftId) return;
    const supabase = createClient();
    let channel: ReturnType<typeof supabase.channel> | null = null;
    let cancelled = false;

    void (async () => {
      // `aircraft` is RLS-protected, and Realtime evaluates those policies as
      // the subscribing user. Without the access token it connects, reports
      // SUBSCRIBED, and then silently delivers nothing — which is exactly how
      // this failed the first time.
      const { data } = await supabase.auth.getSession();
      if (cancelled) return;
      if (data.session?.access_token) {
        await supabase.realtime.setAuth(data.session.access_token);
      }
      if (cancelled) return;

      // Unique name per mount. supabase.channel() hands back a CACHED channel
      // when the name already exists, so under React StrictMode's double-mount
      // the second effect grabbed the first (already-subscribed) channel and
      // .on() threw "cannot add postgres_changes callbacks after subscribe()".
      // The channel stayed subscribed with no handler attached — connected,
      // silent, and indistinguishable from nobody else editing.
      channel = supabase
        .channel(`aircraft:${aircraftId}:${Math.random().toString(36).slice(2, 10)}`)
        .on(
          "postgres_changes",
          { event: "UPDATE", schema: "public", table: "aircraft", filter: `id=eq.${aircraftId}` },
          (payload) => {
            const next = (payload.new as { data?: Record<string, unknown> })?.data;
            if (next) onRemote(next);
          },
        )
        .subscribe((status, err) => {
          // Never swallow this: a channel that fails to subscribe looks
          // identical to one where nobody else is editing.
          if (status === "CHANNEL_ERROR" || status === "TIMED_OUT" || status === "CLOSED") {
            console.warn(`[realtime] aircraft:${aircraftId} → ${status}`, err ?? "");
          }
        });

      // Unmounted while we were awaiting the session — tear down immediately.
      if (cancelled) {
        supabase.removeChannel(channel);
        channel = null;
      }
    })();

    return () => {
      cancelled = true;
      if (channel) supabase.removeChannel(channel);
    };
    // onRemote is held in a ref by the caller; re-subscribing per render would
    // thrash the websocket.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [aircraftId]);
}

/**
 * Watches access grants for the signed-in user. A revocation while the tab is
 * open should take effect immediately — v1's checkOfflineRevocations covered
 * the same case on reconnect.
 */
export function useAccessRealtime() {
  const router = useRouter();
  useAccessChanges(useCallback(() => router.refresh(), [router]));
}

/**
 * Runs `onChange` whenever any aircraft_access row this user can see changes.
 *
 * router.refresh() alone isn't enough for everything: it re-runs server
 * components, but a client component that loaded its own rows in an effect
 * never hears about it, which is why a new invitation didn't raise the banner
 * until a manual reload. v1 re-ran checkPendingInvites() straight from its
 * realtime handler on aircraft_shares; this is the same idea.
 */
export function useAccessChanges(onChange: () => void) {
  const cb = useRef(onChange);
  cb.current = onChange;

  useEffect(() => {
    const supabase = createClient();
    let channel: ReturnType<typeof supabase.channel> | null = null;
    let cancelled = false;

    void (async () => {
      // Mounted from the root layout, so this runs on every authenticated page.
      // Skip entirely when signed out rather than opening a socket that RLS
      // will never deliver anything through.
      const { data } = await supabase.auth.getSession();
      if (cancelled || !data.session?.access_token) return;
      await supabase.realtime.setAuth(data.session.access_token);
      if (cancelled) return;

      channel = supabase
        .channel(`aircraft-access:${Math.random().toString(36).slice(2, 10)}`)
        .on(
          "postgres_changes",
          { event: "*", schema: "public", table: "aircraft_access" },
          () => cb.current(),
        )
        .subscribe((status, err) => {
          if (status === "CHANNEL_ERROR" || status === "TIMED_OUT" || status === "CLOSED") {
            console.warn(`[realtime] aircraft-access → ${status}`, err ?? "");
          }
        });

      if (cancelled) {
        supabase.removeChannel(channel);
        channel = null;
      }
    })();

    return () => {
      cancelled = true;
      if (channel) supabase.removeChannel(channel);
    };
    // cb is a ref — resubscribing whenever the caller re-renders would thrash
    // the websocket for no gain.
  }, []);
}
