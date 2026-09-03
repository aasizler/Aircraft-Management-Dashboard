import { createBrowserClient } from "@supabase/ssr";
import { parse, serialize } from "cookie";
import { sessionScoped } from "./cookie-lifetime";

// Browser-side Supabase client. Safe to use in Client Components — it only ever
// holds the publishable anon key and relies on RLS for authorization.
//
// The cookie handlers are the library's own document.cookie defaults with one
// change: every write goes through sessionScoped(), so the session lives only
// as long as the browser is open. Without this the client's token refresh would
// quietly restamp the 400-day expiry that the middleware just took off.
export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          const parsed = parse(document.cookie);
          return Object.keys(parsed).map((name) => ({
            name,
            value: parsed[name] ?? "",
          }));
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) => {
            document.cookie = serialize(name, value, sessionScoped(options));
          });
        },
      },
    },
  );
}
