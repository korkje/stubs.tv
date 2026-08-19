import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

/**
 * GDPR data export (docs/PRIVACY.md — right of access / portability): the
 * signed-in user downloads everything we hold about them as one JSON file.
 *
 * Deliberately NOT plan-gated: free accounts are read-only, and the whole
 * promise of read-only is "everything stays visible and exportable". The
 * heavy lifting happens in export_user_data() (one SQL round-trip, RLS
 * applies via security invoker); this handler only adds the auth-schema
 * fields the function cannot see and sets the download headers.
 */
export async function GET(request: Request) {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  // The middleware already sends signed-out /app requests to /login; this
  // is a defensive fallback, not the guard.
  if (!user) {
    return NextResponse.redirect(new URL("/login", request.url));
  }

  const { data, error } = await supabase.rpc("export_user_data");
  if (error) {
    throw new Error(`Data export failed: ${error.message}`);
  }

  const body = JSON.stringify(
    {
      exported_at: new Date().toISOString(),
      account: { email: user.email, created_at: user.created_at },
      ...(data as Record<string, unknown>),
    },
    null,
    2
  );

  const date = new Date().toISOString().slice(0, 10);
  return new NextResponse(body, {
    headers: {
      "Content-Type": "application/json",
      "Content-Disposition": `attachment; filename="stubs-export-${date}.json"`,
      // Personal data: never cache anywhere shared.
      "Cache-Control": "no-store",
    },
  });
}
