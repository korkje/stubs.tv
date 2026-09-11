/**
 * Runs once when the Node server boots (Next's instrumentation hook). The
 * only job here is the in-process scheduler for self-hosted deploys
 * (ADR-0021); it is opt-in via INTERNAL_CRON=true and never runs on
 * Cloudflare, where wrangler.jsonc's cron triggers do the same work.
 */
export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;
  if (process.env.INTERNAL_CRON !== "true") return;
  const { startInternalCron } = await import("./lib/internal-cron");
  startInternalCron();
}
