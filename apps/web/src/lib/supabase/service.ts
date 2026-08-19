import "server-only";

import type { Database } from "@stubs/db";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";

/**
 * Supabase client authenticated with the secret (service-role) key.
 *
 * This bypasses row level security entirely, so it must never be imported
 * into a client component — the "server-only" import above turns any such
 * attempt into a build error. Use it solely for metadata ingestion (which
 * includes the import machinery's resolve/ingest calls and its background
 * worker, ADR-0015), the Polar webhook handler (billing sync, ADR-0013),
 * and account deletion (the auth admin API, ADR-0017); all user-scoped
 * access goes through the cookie-based clients in ./server.ts.
 */
export function createServiceClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const secretKey = process.env.SUPABASE_SECRET_KEY;

  if (!url || !secretKey) {
    throw new Error(
      "NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SECRET_KEY must be set for metadata ingestion"
    );
  }

  return createSupabaseClient<Database>(url, secretKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
