import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { sessionScoped } from "./cookie-lifetime";

// Server-side Supabase client for Server Components, Route Handlers, and Server
// Actions. Reads/writes the auth cookie so the session survives navigation.
export async function createClient() {
  const cookieStore = await cookies();

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          // In a Server Component the cookie store is read-only; the middleware
          // refresh path handles writes, so swallowing here is correct.
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, sessionScoped(options)),
            );
          } catch {
            /* called from a Server Component — safe to ignore */
          }
        },
      },
    },
  );
}
