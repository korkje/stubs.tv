import { NextResponse } from "next/server";
import { getPolarClient } from "@/lib/polar";
import { createClient } from "@/lib/supabase/server";

/**
 * Redirects to a Polar-hosted checkout for the product ids in ?products=.
 * Login is required so the checkout carries the app's user id as Polar's
 * external customer id — that id coming back on webhook events is the whole
 * user↔customer mapping (ADR-0013).
 * No successUrl is set on purpose: Polar shows its own hosted confirmation
 * page after payment, so the app needs no confirmation route.
 */
export async function GET(request: Request) {
  const url = new URL(request.url);
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
    return NextResponse.redirect(new URL("/login", url.origin));
  }

  const polar = getPolarClient();
  let checkoutUrl: string;
  try {
    // No customerEmail: Polar hard-rejects undeliverable domains (which all
    // seeded test accounts have) and collects the email on the checkout page
    // anyway — externalCustomerId alone carries the user mapping.
    const checkout = await polar.checkouts.create({
      products,
      externalCustomerId: user.id,
    });
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
