import { NextResponse } from "next/server";
import {
  validateEvent,
  WebhookVerificationError,
} from "@polar-sh/sdk/webhooks";
import { createServiceClient } from "@/lib/supabase/service";

/**
 * Receives Polar webhook events — the only path by which payment state
 * enters the app (ADR-0013). Unauthenticated by design: the Standard
 * Webhooks signature check against POLAR_WEBHOOK_SECRET is what proves the
 * request came from Polar, so nothing may run before validateEvent.
 *
 * Handlers throw on database errors (project convention), which returns a
 * 500 and makes Polar retry the delivery — billing sync must not fail
 * silently.
 */
export async function POST(request: Request) {
  const secret = process.env.POLAR_WEBHOOK_SECRET;
  if (!secret) {
    return new NextResponse("POLAR_WEBHOOK_SECRET is not set", {
      status: 500,
    });
  }

  const body = await request.text();

  let event: ReturnType<typeof validateEvent>;
  try {
    event = validateEvent(
      body,
      {
        "webhook-id": request.headers.get("webhook-id") ?? "",
        "webhook-timestamp": request.headers.get("webhook-timestamp") ?? "",
        "webhook-signature": request.headers.get("webhook-signature") ?? "",
      },
      secret
    );
  } catch (error) {
    if (error instanceof WebhookVerificationError) {
      return NextResponse.json({ received: false }, { status: 403 });
    }
    throw error;
  }

  switch (event.type) {
    case "order.paid": {
      // Subscriptions are synced from customer.state_changed; the one-time
      // lifetime pass never appears there, so it is granted here, keyed on
      // the product's metadata rather than a hardcoded id.
      const order = event.data;
      if (order.product?.metadata.lifetime !== true) break;

      // No external id means the checkout was created without a logged-in
      // app user (e.g. a bare dashboard checkout link) — nothing to grant.
      const userId = order.customer.externalId;
      if (!userId) break;

      const supabase = createServiceClient();
      const { error: billingError } = await supabase.from("billing").upsert({
        user_id: userId,
        polar_customer_id: order.customerId,
        lifetime: true,
        updated_at: new Date().toISOString(),
      });
      if (billingError) {
        throw new Error(`billing upsert failed: ${billingError.message}`);
      }

      const { error: planError } = await supabase
        .from("profiles")
        .update({ plan: "paid" })
        .eq("user_id", userId);
      if (planError) {
        throw new Error(`plan update failed: ${planError.message}`);
      }
      break;
    }

    case "customer.state_changed": {
      // Fires on every subscription lifecycle change and carries the full
      // current state, so this handler is idempotent: recompute rather than
      // increment. activeSubscriptions only ever holds active/trialing.
      const state = event.data;
      const userId = state.externalId;
      if (!userId) break;

      const sub = state.activeSubscriptions[0];

      const supabase = createServiceClient();
      const { data: billing, error: billingError } = await supabase
        .from("billing")
        .upsert({
          user_id: userId,
          polar_customer_id: state.id,
          subscription_status: sub ? String(sub.status) : null,
          current_period_end: sub ? sub.currentPeriodEnd.toISOString() : null,
          updated_at: new Date().toISOString(),
        })
        .select("lifetime")
        .single();
      if (billingError) {
        // 23503: the user id no longer exists (account deleted, cascade took
        // the billing row). Polar can keep sending events for the orphaned
        // customer; acknowledging beats a 500 retry loop.
        if (billingError.code === "23503") break;
        throw new Error(`billing upsert failed: ${billingError.message}`);
      }

      // A lapsed subscription must not revoke a lifetime pass — and a
      // downgrade must never touch comp: comp is granted by hand and any
      // Polar activity without an active subscription (say, a one-time
      // order) would otherwise stomp it to free. Upgrades may apply to
      // anyone; they only ever fire for a paying customer.
      const plan = billing.lifetime || sub ? "paid" : "free";
      let query = supabase.from("profiles").update({ plan }).eq("user_id", userId);
      if (plan === "free") query = query.neq("plan", "comp");
      const { error: planError } = await query;
      if (planError) {
        throw new Error(`plan update failed: ${planError.message}`);
      }
      break;
    }
  }

  return NextResponse.json({ received: true });
}
