import { NextResponse } from "next/server";
import { getPolarClient } from "@/lib/polar";
import { createClient } from "@/lib/supabase/server";
import { isSelfHosted } from "@/lib/self-hosted";

/**
 * Redirects to a Polar-hosted checkout for the product ids in ?products=.
 * Login is required so the checkout carries the app's user id as Polar's
 * external customer id — that id coming back on webhook events is the whole
 * user↔customer mapping (ADR-0013).
 * successUrl brings the customer back to the app after Polar's confirmation
 * — derived from the request origin so it works self-hosted and locally.
 * The read-only banner can linger for the seconds until the webhook lands;
 * the /app layout comment documents that transient.
 */
export async function GET(request: Request) {
  const url = new URL(request.url);
  // Self-hosted instances sell nothing (ADR-0019); a stray pricing link
  // lands in the app instead of on a Polar error.
  if (isSelfHosted()) {
    return NextResponse.redirect(new URL("/app", url.origin));
  }
  const products = url.searchParams.getAll("products");
  if (products.length === 0) {
    return NextResponse.json(
      { error: "Missing products in query params" },
      { status: 400 }
    );
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    // Preserve the destination so a pricing click made while logged out
    // arrives back here (and on to Polar) after signing in.
    const next = encodeURIComponent(url.pathname + url.search);
    return NextResponse.redirect(new URL(`/login?next=${next}`, url.origin));
  }

  const polar = getPolarClient();
  let checkoutUrl: string;
  try {
    const base = {
      products,
      externalCustomerId: user.id,
      successUrl: `${url.origin}/app`,
    };
    let checkout;
    try {
      // customerEmail prefills the checkout page — one field fewer for a
      // real customer to type. The mapping never depends on it:
      // externalCustomerId alone ties webhook events back to the user.
      checkout = await polar.checkouts.create({
        ...base,
        customerEmail: user.email,
      });
    } catch {
      // Polar hard-rejects undeliverable domains at create time, which all
      // seeded test accounts have (@stubs.local, @example.com). Retry
      // without the prefill; Polar collects the email on the page instead.
      checkout = await polar.checkouts.create(base);
    }
    checkoutUrl = checkout.url;
  } catch (error) {
    // Never rethrow SDK errors: they embed the raw request, Authorization
    // header included, and anything thrown here gets dumped to the worker's
    // logs. Keep the message, drop the object.
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(`Polar checkout create failed: ${message}`);
  }

  return NextResponse.redirect(checkoutUrl, 302);
}
