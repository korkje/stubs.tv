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
    const host = (await headers()).get("host") ?? "stubs.tv";
    const proto =
      host.startsWith("localhost") || host.startsWith("127.") ? "http" : "https";
    const kick = fetch(`${proto}://${host}/api/import/run`, {
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
