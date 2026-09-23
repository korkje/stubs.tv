import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/service";
import { ensureSeriesIngested } from "@/lib/metadata/ingest";
import { runMetadataSync, type SyncReport } from "@/lib/metadata/sync";
import { isCronRequest } from "@/lib/cron-auth";

/**
 * Background jobs stay batched and resumable as policy (AGENTS.md), but two
 * an hour fell behind as soon as more than two followed shows changed in an
 * hour. Twenty, stalest first, fits comfortably in the paid plan (ADR-0016);
 * DEADLINE_MS stops a slow provider from dragging the run past its budget.
 */
const BATCH = 20;
/** Stop starting new series once the run has used this much time. */
const DEADLINE_MS = 20_000;

/**
 * Hourly freshness, in two acts (docs/plans/metadata-updates.md). First the
 * delta sync reads the provider's /updates feed and *invalidates* what
 * changed (fetched_at = null); then the sweep below refetches the stalest
 * followed series — and because invalidated rows sort first, a followed
 * show that changed this hour is refetched in the same invocation.
 * Invalidated movies and unfollowed series heal on next open instead.
 *
 * Invoked by the worker's cron trigger (see custom-worker.ts) with the
 * CRON_SECRET header; it is also reachable over HTTPS, hence the guard.
 * Metadata ingestion stays the only code path that talks to the provider
 * (ADR-0004) — this just decides who is due.
 */
export async function GET(request: Request) {
  if (!(await isCronRequest(request))) {
    return new NextResponse("Unauthorized", { status: 401 });
  }

  // A sync failure (TVDB down, feed hiccup) must not cost the sweep too:
  // the 12h window plus nulls-first ordering means the sweep alone still
  // converges, just slower — exactly the pre-sync behaviour.
  let sync: SyncReport | { error: string };
  try {
    sync = await runMetadataSync();
  } catch (error) {
    sync = { error: error instanceof Error ? error.message : String(error) };
    console.error(`Metadata sync failed: ${sync.error}`);
  }

  const supabase = createServiceClient();
  const startedAt = Date.now();

  // Picked in SQL: followed by anyone, stalest first, recent failures
  // skipped. Reading every follow into the Worker hit PostgREST's row cap
  // and, sent back as one `in()` list, the URL limit.
  const { data: stale, error: staleError } = await supabase.rpc(
    "stale_followed_series",
    { p_limit: BATCH }
  );
  if (staleError) {
    return NextResponse.json({ error: staleError.message }, { status: 500 });
  }

  const refreshed: string[] = [];
  const failed: string[] = [];
  for (const row of stale ?? []) {
    if (Date.now() - startedAt > DEADLINE_MS) break;
    try {
      // No-ops when the row is already fresh; stalest-first ordering means
      // that happens only when the whole catalogue is up to date.
      await ensureSeriesIngested(row.id);
      refreshed.push(row.name);
    } catch (error) {
      // One title the provider keeps failing on must not stall the sweep
      // for everyone: note the failure, so the next few hours pass it by,
      // and carry on with the rest.
      const message = error instanceof Error ? error.message : String(error);
      failed.push(`${row.name}: ${message}`);
      console.error(`Refresh of series ${row.id} failed: ${message}`);
      const { error: stampError } = await supabase
        .from("series")
        .update({ refresh_failed_at: new Date().toISOString() })
        .eq("id", row.id);
      if (stampError) {
        console.error(`Could not stamp the failed refresh: ${stampError.message}`);
      }
    }
  }

  return NextResponse.json({
    sync,
    refreshed,
    ...(failed.length ? { failed } : {}),
  });
}
