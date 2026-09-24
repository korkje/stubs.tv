import type { Database } from "@stubs/db";
import { createServerClient } from "@supabase/ssr";
import { cookies, headers } from "next/headers";
import { limitedFetch, VISITOR_IP_HEADER } from "@/lib/auth/rate-limit";
import { AUTH_COOKIE_OPTIONS } from "./cookies";

export async function createClient() {
  const cookieStore = await cookies();
  const headerStore = await headers();

  return createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookieOptions: AUTH_COOKIE_OPTIONS,
      // Each visitor's own limit on GoTrue calls (ADR-0026).
      global: {
        fetch: limitedFetch(() => headerStore.get(VISITOR_IP_HEADER)),
      },
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            );
          } catch {
            // Called from a Server Component — session refresh is handled by
            // the proxy, so this can be safely ignored.
          }
        },
      },
    }
  );
}
