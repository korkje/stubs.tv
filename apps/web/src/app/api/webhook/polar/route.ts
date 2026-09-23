import { NextResponse } from "next/server";
import {
  validateEvent,
  WebhookVerificationError,
} from "@polar-sh/sdk/webhooks";
import { createServiceClient } from "@/lib/supabase/service";
import { getPolarClient } from "@/lib/polar";
import { grantsLifetime, ownsLifetimePass } from "@/lib/billing/lifetime";

type Service = ReturnType<typeof createServiceClient>;

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

      // A lapsed subscription must not revoke a lifetime pass. Upgrades may
      // apply to anyone; they only ever fire for a paying customer.
      await applyPlan(supabase, userId, billing.lifetime || sub ? "paid" : "free");
      break;
    }

    case "order.refunded": {
      // Sent for full and partial refunds alike, including the ones Polar
      // issues on its own to head off a chargeback. Subscriptions don't need
      // it: a refund leaves one running, and ending it arrives through
      // customer.state_changed. The lifetime pass is the only thing granted
      // per order, so it is the only thing taken back per order.
      const order = event.data;
      if (order.product?.metadata.lifetime !== true) break;
      const userId = order.customer.externalId;
      if (!userId) break;

      // Recompute rather than revoke: a partial refund keeps the pass, and so
      // does a second lifetime order that still stands. This order's own
      // state settles the first; Polar's current orders settle the second.
      const lifetime =
        grantsLifetime(order) ||
        (await ownsLifetimePass(getPolarClient(), order.customerId));

      const supabase = createServiceClient();
      const { data: billing, error: billingError } = await supabase
        .from("billing")
        .update({ lifetime, updated_at: new Date().toISOString() })
        .eq("user_id", userId)
        .select("subscription_status")
        .maybeSingle();
      if (billingError) {
        throw new Error(`billing update failed: ${billingError.message}`);
      }
      // No billing row: the pass was never granted, or the account (and its
      // billing row with it) is gone. Nothing to take back.
      if (!billing) break;

      // A refund only ever takes access away. If the pass or a subscription
      // still stands, the plan is already right, and rewriting it to paid
      // could stomp a comp granted since.
      if (!lifetime && billing.subscription_status === null) {
        await applyPlan(supabase, userId, "free");
      }
      break;
    }
  }

  return NextResponse.json({ received: true });
}

/**
 * Writes the plan that a user's billing implies. A downgrade never touches
 * comp: comp is granted by hand, and Polar activity without an active
 * subscription (a one-time order, a refund) would otherwise stomp it to free.
 */
async function applyPlan(
  supabase: Service,
  userId: string,
  plan: "paid" | "free"
): Promise<void> {
  let query = supabase.from("profiles").update({ plan }).eq("user_id", userId);
  if (plan === "free") query = query.neq("plan", "comp");
  const { error } = await query;
  if (error) {
    throw new Error(`plan update failed: ${error.message}`);
  }
}
