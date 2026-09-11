// Calling an edge function with a deadline.
//
// supabase-js's functions.invoke() takes no AbortSignal, so a stalled request
// spins the UI forever — and it collapses every non-2xx into a generic
// FunctionsHttpError, discarding the server's actual message. This wraps fetch
// directly so both problems go away: real cancellation, and the error text the
// function meant to send.

import { createClient } from "@/lib/supabase/client";

/**
 * Vision calls are the slow path here (a meter photo through Sonnet runs a few
 * seconds; a cold function start adds a couple more). 45s is far past the p99
 * while still bounding the spinner.
 */
const VISION_TIMEOUT_MS = 45_000;

export type EdgeResult<T> = { data: T; error: null } | { data: null; error: string };

/**
 * Turn a relayed upstream failure into something a pilot can act on.
 *
 * The vision functions pass Anthropic's status straight through as
 * "anthropic 401", which reads like the user's own sign-in expired when it is
 * really the vendor key in Supabase's Edge Function secrets being rejected.
 * That distinction matters: one is "log in again", the other is "nobody can
 * scan anything until the key is replaced".
 */
function humanise(msg: string): string {
  if (/anthropic 401|authentication_error|API key is invalid/i.test(msg)) {
    return "The scanning service rejected its API key — set a valid ANTHROPIC_API_KEY in the Supabase Edge Function secrets. This is a server setting, not your sign-in.";
  }
  if (/ANTHROPIC_API_KEY not configured/i.test(msg)) {
    return "The scanning service has no API key configured — set ANTHROPIC_API_KEY in the Supabase Edge Function secrets.";
  }
  if (/anthropic 429|rate_limit/i.test(msg)) {
    return "The scanning service is rate limited right now — wait a moment and try again.";
  }
  if (/anthropic 5\d\d|overloaded/i.test(msg)) {
    return "The scanning service is temporarily unavailable — try again in a minute.";
  }
  return msg;
}

export async function invokeEdge<T>(
  name: string,
  body: unknown,
  { timeoutMs = VISION_TIMEOUT_MS }: { timeoutMs?: number } = {},
): Promise<EdgeResult<T>> {
  const base = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (!base) return { data: null, error: "Supabase URL is not configured." };

  const supabase = createClient();
  const {
    data: { session },
  } = await supabase.auth.getSession();
  if (!session?.access_token) {
    return { data: null, error: "You appear to be signed out — reload and try again." };
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const res = await fetch(`${base}/functions/v1/${name}`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${session.access_token}`,
      },
      body: JSON.stringify(body),
      signal: controller.signal,
    });

    const text = await res.text();
    let parsed: unknown = null;
    try {
      parsed = text ? JSON.parse(text) : null;
    } catch {
      /* non-JSON body — handled below */
    }

    if (!res.ok) {
      const msg =
        (parsed as { error?: string } | null)?.error ??
        (text ? text.slice(0, 300) : `Request failed (${res.status})`);
      return { data: null, error: humanise(msg) };
    }
    if (parsed && typeof parsed === "object" && "error" in parsed) {
      return { data: null, error: humanise(String((parsed as { error: unknown }).error)) };
    }
    return { data: parsed as T, error: null };
  } catch (e) {
    if ((e as Error).name === "AbortError") {
      return {
        data: null,
        error: `Timed out after ${Math.round(timeoutMs / 1000)}s — check your connection and try again.`,
      };
    }
    return { data: null, error: (e as Error).message || "Network error." };
  } finally {
    clearTimeout(timer);
  }
}
