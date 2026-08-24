import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/service";
import { ensureSeriesIngested } from "@/lib/metadata/ingest";
import { runMetadataSync, type SyncReport } from "@/lib/metadata/sync";

/**
 * Small on purpose: background jobs stay batched and resumable as policy
 * (AGENTS.md) even though the paid plan's subrequest cap is roomy
 * (ADR-0016). The cron fires hourly and always takes the stalest first, so
 * a modest catalogue cycles well inside ensureSeriesIngested's 12h
 * freshness window; raise BATCH before rearchitecting if that stops
 * holding.
 */
const BATCH = 2;

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
  const secret = process.env.CRON_SECRET;
  if (!secret || request.headers.get("x-cron-key") !== secret) {
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

  // Followed by anyone: this is a system-wide sweep, so the service role
  // reading every user's follows is the point, not a leak.
  const { data: follows, error: followsError } = await supabase
    .from("follows")
    .select("entity_id")
    .eq("entity_type", "series");
  if (followsError) {
    return NextResponse.json({ error: followsError.message }, { status: 500 });
  }

  const followedIds = [...new Set((follows ?? []).map((f) => f.entity_id))];
  if (followedIds.length === 0) {
    return NextResponse.json({ sync, refreshed: [] });
  }

  const { data: stale, error: staleError } = await supabase
    .from("series")
    .select("id, name")
    .in("id", followedIds)
    .order("fetched_at", { ascending: true, nullsFirst: true })
    .limit(BATCH);
  if (staleError) {
    return NextResponse.json({ error: staleError.message }, { status: 500 });
  }

  const refreshed: string[] = [];
  for (const row of stale ?? []) {
    // No-ops when the row is already fresh; stalest-first ordering means
    // that happens only when the whole catalogue is up to date.
    await ensureSeriesIngested(row.id);
    refreshed.push(row.name);
  }

  return NextResponse.json({ sync, refreshed });
}
