/**
 * In-process replacement for the Workers cron triggers (ADR-0021).
 *
 * On Cloudflare, wrangler.jsonc schedules two jobs and custom-worker.ts
 * turns each into a guarded request: the import sweep every five minutes,
 * the metadata refresh every hour. A plain Node deploy has no scheduler,
 * so this mirrors that schedule with timers that call the same routes on
 * the local port with the same CRON_SECRET header. Both routes are batched,
 * resumable and idempotent by policy (AGENTS.md), so a missed or doubled
 * tick is harmless — which is also why this stays a dumb interval rather
 * than a cron library.
 */

const FIVE_MINUTES = 5 * 60 * 1000;
const ONE_HOUR = 60 * 60 * 1000;
const FIRST_REFRESH_DELAY = 60 * 1000;

export function startInternalCron(): void {
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    console.warn(
      "INTERNAL_CRON=true but CRON_SECRET is unset — the refresh and import jobs will not run."
    );
    return;
  }

  const base = `http://127.0.0.1:${process.env.PORT ?? "3000"}`;

  const hit = async (path: string) => {
    try {
      const res = await fetch(`${base}${path}`, {
        headers: { "x-cron-key": secret },
      });
      if (!res.ok) {
        console.error(`internal cron: ${path} responded ${res.status}`);
      }
    } catch (error) {
      console.error(
        `internal cron: ${path} failed: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  };

  // Same schedule as wrangler.jsonc. `unref()` keeps the timers from
  // holding the process open on shutdown.
  setInterval(() => void hit("/api/import/run"), FIVE_MINUTES).unref();
  setInterval(() => void hit("/api/refresh"), ONE_HOUR).unref();
  // One early refresh so a fresh instance is not stale for its first hour.
  setTimeout(() => void hit("/api/refresh"), FIRST_REFRESH_DELAY).unref();

  console.log(
    "internal cron: /api/import/run every 5 min, /api/refresh hourly (first run in 60s)"
  );
}
