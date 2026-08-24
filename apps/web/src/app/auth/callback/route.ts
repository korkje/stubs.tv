import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { safeNext } from "@/lib/redirects";

/**
 * Where the OAuth dance lands (PKCE): sign-in and signup buttons, and the
 * settings "Connect" flow, all come back here. Exchanges the code for a
 * session and forwards to `next`. Distinct from /auth/confirm, which
 * verifies emailed token hashes — GoTrue's two return channels.
 *
 * The Supabase dashboard's redirect allow-list must contain this URL, or
 * GoTrue silently falls back to the Site URL and the code is never
 * exchanged (documented in docs/DEPLOYMENT.md).
 */
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  // safeNext, or the query param is an open redirect to anywhere.
  const next = safeNext(searchParams.get("next")) ?? "/app";
  // Errors from a Connect attempt belong on the settings page the user is
  // still on; sign-in errors belong on the login form.
  const settingsFlow = next.startsWith("/app/settings");

  const fail = (message: string) => {
    const target = settingsFlow
      ? `/app/settings?tab=account&link_error=${encodeURIComponent(message)}`
      : `/login?error=${encodeURIComponent(message)}`;
    return NextResponse.redirect(new URL(target, request.url));
  };

  // GoTrue reports provider/link failures as query params on the redirect.
  const errorCode = searchParams.get("error_code");
  const errorDescription = searchParams.get("error_description");
  if (searchParams.get("error") || errorCode || errorDescription) {
    if (errorCode === "identity_already_exists") {
      return fail(
        "That sign-in is already connected to a different account. Sign in to that account to manage it."
      );
    }
    return fail(
      errorDescription ?? "Sign-in was cancelled or failed. Try again."
    );
  }

  const code = searchParams.get("code");
  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      return NextResponse.redirect(new URL(next, request.url));
    }
    return fail(error.message);
  }

  return fail("Sign-in did not complete. Try again.");
}
