import "server-only";

import { getCloudflareContext } from "@opennextjs/cloudflare";
import { headers } from "next/headers";

/**
 * Nudge the import worker so a fresh commit starts materialising now
 * instead of on the next cron tick. One self-fetch, no chaining: the
 * five-minute cron is the actual delivery guarantee, this is only latency —
 * so every failure mode here is swallowed on purpose.
 */
export async function kickImportWorker(): Promise<void> {
  const secret = process.env.CRON_SECRET;
  if (!secret) return;
  try {
    // This request carries CRON_SECRET, so the target must not come from
    // anything a client controls. On a Node deploy (ADR-0021, marked by
    // INTERNAL_CRON) the worker is on loopback; on Workers the custom-domain
    // route pins Host to stubs.tv, so the header is safe there.
    const base =
      process.env.INTERNAL_CRON === "true"
        ? `http://127.0.0.1:${process.env.PORT ?? "3000"}`
        : await hostBase();
    const kick = fetch(`${base}/api/import/run`, {
      headers: { "x-cron-key": secret },
    }).then(
      () => undefined,
      () => undefined
    );
    try {
      getCloudflareContext().ctx.waitUntil(kick);
    } catch {
      // next dev has no execution context; a floating promise is fine there.
    }
  } catch {
    // Never fail a commit over the nudge.
  }
}

async function hostBase(): Promise<string> {
  const host = (await headers()).get("host") ?? "stubs.tv";
  const proto =
    host.startsWith("localhost") || host.startsWith("127.") ? "http" : "https";
  return `${proto}://${host}`;
}
