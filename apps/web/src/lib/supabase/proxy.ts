import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request });

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
            request.cookies.set(name, value)
          );
          supabaseResponse = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  // Do not run code between createServerClient and auth.getUser() —
  // it can cause users to be randomly logged out.
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const path = request.nextUrl.pathname;
  const needsAuth = path.startsWith("/app") || path.startsWith("/admin");

  if (!user && needsAuth) {
    // Build the login URL from scratch: cloning nextUrl would carry the
    // original query string onto /login, where params like error/next/deleted
    // have meanings of their own.
    const url = new URL("/login", request.url);
    const next = path + request.nextUrl.search;
    if (next !== "/app") url.searchParams.set("next", next);
    return NextResponse.redirect(url);
  }

  return supabaseResponse;
}
