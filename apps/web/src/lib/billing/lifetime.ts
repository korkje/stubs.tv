import type { Polar } from "@polar-sh/sdk";

/** The parts of a Polar order that decide whether it grants the lifetime pass. */
interface OrderLike {
  status: string;
  product: { metadata: Record<string, unknown> } | null;
}

/**
 * Whether an order grants the lifetime pass: a lifetime product (keyed on
 * product metadata, as order.paid is, never a hardcoded id), paid, and at
 * most partly refunded. A partial refund is goodwill, not a return.
 */
export function grantsLifetime(order: OrderLike): boolean {
  return (
    order.product?.metadata.lifetime === true &&
    (order.status === "paid" || order.status === "partially_refunded")
  );
}

/**
 * Whether a Polar customer still holds a lifetime pass, read live from
 * Polar. A refund webhook describes one order, but a customer can own two
 * (a duplicate purchase is the classic refund), and only the current state
 * of all of them says whether the pass stands.
 *
 * Takes the client rather than importing it, so this stays free of the
 * server-only module graph and unit-testable.
 */
export async function ownsLifetimePass(
  polar: Pick<Polar, "orders">,
  customerId: string
): Promise<boolean> {
  try {
    const pages = await polar.orders.list({ customerId, limit: 100 });
    for await (const page of pages) {
      if (page.result.items.some(grantsLifetime)) return true;
    }
    return false;
  } catch (error) {
    // Never rethrow SDK errors: they embed the raw request, Authorization
    // header included (same rule as the checkout route).
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(`Polar order lookup failed: ${message}`);
  }
}
