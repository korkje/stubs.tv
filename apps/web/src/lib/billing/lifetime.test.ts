import type { Polar } from "@polar-sh/sdk";
import { describe, expect, it } from "vitest";
import { grantsLifetime, ownsLifetimePass } from "./lifetime";

type Order = Parameters<typeof grantsLifetime>[0];

const lifetime = (status: string): Order => ({
  status,
  product: { metadata: { lifetime: true } },
});
const monthly = (status: string): Order => ({
  status,
  product: { metadata: {} },
});

/** A stand-in Polar client that serves the given pages of orders. */
function polarWith(pages: Order[][], seen: unknown[] = []) {
  return {
    orders: {
      list: async (request: unknown) => {
        seen.push(request);
        return (async function* () {
          for (const items of pages) yield { result: { items } };
        })();
      },
    },
  } as unknown as Pick<Polar, "orders">;
}

describe("grantsLifetime", () => {
  it("counts paid and partly refunded lifetime orders", () => {
    expect(grantsLifetime(lifetime("paid"))).toBe(true);
    expect(grantsLifetime(lifetime("partially_refunded"))).toBe(true);
  });

  it("ignores refunded, unpaid and non-lifetime orders", () => {
    expect(grantsLifetime(lifetime("refunded"))).toBe(false);
    expect(grantsLifetime(lifetime("pending"))).toBe(false);
    expect(grantsLifetime(monthly("paid"))).toBe(false);
    expect(grantsLifetime({ status: "paid", product: null })).toBe(false);
    // Metadata must be the boolean, as order.paid requires.
    expect(
      grantsLifetime({ status: "paid", product: { metadata: { lifetime: "true" } } })
    ).toBe(false);
  });
});

describe("ownsLifetimePass", () => {
  it("keeps the pass while a second lifetime order stands", async () => {
    const seen: unknown[] = [];
    const polar = polarWith([[lifetime("refunded"), lifetime("paid")]], seen);
    await expect(ownsLifetimePass(polar, "cus_1")).resolves.toBe(true);
    expect(seen).toEqual([{ customerId: "cus_1", limit: 100 }]);
  });

  it("drops it once every lifetime order is refunded", async () => {
    const polar = polarWith([[lifetime("refunded"), monthly("paid")]]);
    await expect(ownsLifetimePass(polar, "cus_1")).resolves.toBe(false);
  });

  it("looks past the first page", async () => {
    const polar = polarWith([[monthly("paid")], [lifetime("partially_refunded")]]);
    await expect(ownsLifetimePass(polar, "cus_1")).resolves.toBe(true);
  });

  it("reports a failed lookup without the SDK's error object", async () => {
    const failure = Object.assign(new Error("Unauthorized"), {
      rawRequest: { headers: { Authorization: "Bearer polar_oat_secret" } },
    });
    const polar = {
      orders: {
        list: async () => {
          throw failure;
        },
      },
    } as unknown as Pick<Polar, "orders">;
    const lookup = ownsLifetimePass(polar, "cus_1");
    await expect(lookup).rejects.toThrow("Polar order lookup failed: Unauthorized");
    await lookup.catch((error: Error) => {
      expect(error).not.toBe(failure);
      expect(JSON.stringify(error)).not.toContain("polar_oat_secret");
    });
  });
});
