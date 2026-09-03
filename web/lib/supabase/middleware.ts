import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { sessionScoped } from "./cookie-lifetime";

// Refreshes the Supabase session on every request and gates the app behind
// auth. Public routes (login / auth callback) are allowed through unauthenticated.
export async function updateSession(request: NextRequest) {
  let response = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value),
          );
          response = NextResponse.next({ request });
          // Session-scoped: the refreshed token must not come back with the
          // library's 400-day expiry, or every request undoes the client's work.
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, sessionScoped(options)),
          );
        },
      },
    },
  );

  // IMPORTANT: getUser() must run to refresh the token. Do not remove.
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const isPublic =
    request.nextUrl.pathname.startsWith("/login") ||
    request.nextUrl.pathname.startsWith("/auth");

  if (!user && !isPublic) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    return NextResponse.redirect(url);
  }

  return response;
}
