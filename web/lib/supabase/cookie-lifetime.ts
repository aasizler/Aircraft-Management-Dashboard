import type { CookieOptions } from "@supabase/ssr";

/**
 * Drop the lifetime off an auth cookie so the browser discards it when it
 * closes, instead of keeping you signed in on that machine for 400 days.
 *
 * This has to be done here, in our own setAll handlers, and not through the
 * library's `cookieOptions`. @supabase/ssr builds its write options as
 * `{ ...DEFAULT_COOKIE_OPTIONS, ...cookieOptions, maxAge: DEFAULT.maxAge }` —
 * the default is re-applied last, so anything passed in is overwritten. By the
 * time options reach setAll the 400 days is already on them, and stripping is
 * the only lever left.
 *
 * A removal is not a lifetime we may touch: sign-out and chunk cleanup delete
 * cookies by setting maxAge 0 or a past expiry, and dropping that turns the
 * delete into a write that resurrects the session.
 */
export function sessionScoped(options: CookieOptions): CookieOptions {
  const expiring =
    options.maxAge != null && options.maxAge <= 0
      ? true
      : options.expires instanceof Date && options.expires.getTime() <= Date.now();
  if (expiring) return options;

  const rest = { ...options };
  delete rest.maxAge;
  delete rest.expires;
  return rest;
}
