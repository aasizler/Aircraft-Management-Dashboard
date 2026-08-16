import { type NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase/middleware";

// Next 16 renamed the "middleware" convention to "proxy". Same request-time hook.
export async function proxy(request: NextRequest) {
  return updateSession(request);
}

export const config = {
  // Run on everything except static assets and image optimization.
  //
  // `maplibre` and the .mjs/.js extensions matter: the MapLibre web worker is
  // served from /public, and putting an auth redirect in front of it means any
  // session hiccup 307s the worker script. The worker then never answers, the
  // style never finishes loading, and the map silently renders nothing.
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|maplibre|.*\\.(?:svg|png|jpg|jpeg|gif|webp|mjs|js|css|csv)$).*)",
  ],
};
