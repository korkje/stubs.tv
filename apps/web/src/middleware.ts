import { type NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase/proxy";

// Next 16 prefers proxy.ts (Node runtime), but @opennextjs/cloudflare does
// not support Node middleware yet — the deprecated edge middleware.ts
// convention is the documented workaround. Rename to proxy.ts once
// https://github.com/opennextjs/opennextjs-cloudflare/issues/962 is fixed.
export async function middleware(request: NextRequest) {
  return await updateSession(request);
}

export const config = {
  matcher: [
    // Everything except static assets.
    "/((?!_next/static|_next/image|favicon.ico|manifest.webmanifest|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)",
  ],
};
