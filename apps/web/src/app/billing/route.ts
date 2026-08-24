import { NextResponse } from "next/server";
import { getPolarClient } from "@/lib/polar";
import { createClient } from "@/lib/supabase/server";
import { isSelfHosted } from "@/lib/self-hosted";

/**
 * The un-personalised portal entrance. Kept as the fallback: it asks for an
 * email and mails a sign-in code, which always works even when a session
 * can't be created (no Polar customer yet, sandbox quirks, SDK errors).
 */
const POLAR_PORTAL_URL = "https://polar.sh/stubs-tv/portal";

/**
 * Redirects to Polar's customer portal, signed in. A customer session is
 * created against the same external customer id the checkout stamped
 * (ADR-0013), so the customer skips Polar's emailed sign-in code — the
 * portal equivalent of the checkout's email prefill. Auth is required
 * because the session URL grants access to invoices and payment methods;
 * anything that goes wrong falls back to the code-based portal entrance
 * rather than a broken page.
 */
export async function GET(request: Request) {
  const url = new URL(request.url);

  // No merchant, no portal on a self-hosted instance (ADR-0019).
  if (isSelfHosted()) {
    return NextResponse.redirect(new URL("/app", url.origin));
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    const next = encodeURIComponent(url.pathname);
    return NextResponse.redirect(new URL(`/login?next=${next}`, url.origin));
  }

  // No billing row means the account never checked out (comp accounts,
  // never-paid free accounts) — there is no Polar customer to manage.
  const { data: billing } = await supabase
    .from("billing")
    .select("user_id")
    .maybeSingle();
  if (!billing) {
    return NextResponse.redirect(new URL("/app/plans", url.origin));
  }

  try {
    const polar = getPolarClient();
    const session = await polar.customerSessions.create({
      externalCustomerId: user.id,
      returnUrl: `${url.origin}/app/settings?tab=billing`,
    });
    return NextResponse.redirect(session.customerPortalUrl, 302);
  } catch {
    // Deliberately swallowed: SDK errors embed the raw request including
    // the Authorization header, and the code-based portal is a fine
    // fallback — never a reason to error the page.
    return NextResponse.redirect(POLAR_PORTAL_URL, 302);
  }
}
