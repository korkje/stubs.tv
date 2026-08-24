import "server-only";

import type { ProviderChange } from "@stubs/metadata";
import { createServiceClient } from "@/lib/supabase/service";
import { getMetadataProvider } from "./provider";

const PROVIDER = "tvdb" as const;

/**
 * Overlap between runs. The feed is read from (cursor - overlap) so a record
 * written in the instant the previous run stamped its cursor is still seen.
 * Re-seeing records is free: invalidation is idempotent.
 */
const OVERLAP_MS = 5 * 60 * 1000;

/**
 * The furthest back one run will read the feed. A cursor older than this
 * (paused deploy, long outage) is clamped, and the missed window is healed
 * the blunt way: every followed series is invalidated. TVDB accepted a
 * 30-day `since` when probed (2026-08-24), but a month of catalogue churn
 * is pages of noise for changes the sweep can recover anyway.
 */
const MAX_LOOKBACK_MS = 7 * 24 * 60 * 60 * 1000;

export interface SyncReport {
  /** ISO time the feed was read from, or null when the run only initialized the cursor. */
  since: string | null;
  initialized?: boolean;
  /** Feed records for entity types we store (whole catalogue, pre-intersection). */
  records?: number;
  invalidatedSeries?: number;
  invalidatedMovies?: number;
  /** Held titles deleted at the provider — stamped fresh, left in place. */
  deleted?: number;
  /** Held titles whose provider id was repointed to a merge survivor. */
  merged?: number;
  /** Merges we refused (both sides held, or an episode merge) — logged for a human. */
  skippedMerges?: string[];
  /** False when the page budget cut the read short or the cursor was clamped:
   *  the window may be incomplete, so followed series were invalidated wholesale. */
  complete?: boolean;
}

function check(context: string, error: { message: string } | null): void {
  if (error) throw new Error(`Metadata sync failed (${context}): ${error.message}`);
}

type HeldRow = { entity_type: string; entity_id: number; provider_id: string };

/**
 * Which of these provider ids do we hold? Returns provider_id → internal id.
 */
async function heldIds(
  entityType: "series" | "movie" | "episode",
  providerIds: string[]
): Promise<Map<string, number>> {
  if (providerIds.length === 0) return new Map();
  const supabase = createServiceClient();

  const held = new Map<string, number>();
  // .in() renders into the request URL; chunk so a busy hour cannot
  // overflow it.
  for (let i = 0; i < providerIds.length; i += 200) {
    const { data, error } = await supabase
      .from("external_ids")
      .select("entity_type, entity_id, provider_id")
      .eq("provider", PROVIDER)
      .eq("entity_type", entityType)
      .in("provider_id", providerIds.slice(i, i + 200));
    check(`lookup held ${entityType} ids`, error);
    for (const row of (data ?? []) as HeldRow[]) held.set(row.provider_id, row.entity_id);
  }
  return held;
}

/** fetched_at = null → isStale() is true → refetched by the sweep (followed
 *  series, nulls first) or on next open (movies, unfollowed series). Note the
 *  overload: null also means "never-fetched stub"; eviction work must not
 *  read it as "safe to drop" without checking user references either way. */
async function invalidate(table: "series" | "movies", ids: number[]): Promise<number> {
  if (ids.length === 0) return 0;
  const supabase = createServiceClient();
  for (let i = 0; i < ids.length; i += 200) {
    const { error } = await supabase
      .from(table)
      .update({ fetched_at: null })
      .in("id", ids.slice(i, i + 200));
    check(`invalidate ${table}`, error);
  }
  return ids.length;
}

/** Deleted at the provider: stamp fresh so the sweep never wastes a slot
 *  refetching a record that can no longer answer. The row and every user
 *  reference to it stay — watch history outlives the provider's catalogue. */
async function stampDeleted(table: "series" | "movies", ids: number[]): Promise<number> {
  if (ids.length === 0) return 0;
  const supabase = createServiceClient();
  const { error } = await supabase
    .from(table)
    .update({ fetched_at: new Date().toISOString() })
    .in("id", ids);
  check(`stamp deleted ${table}`, error);
  return ids.length;
}

async function invalidateAllFollowedSeries(): Promise<number> {
  const supabase = createServiceClient();
  const { data, error } = await supabase
    .from("follows")
    .select("entity_id")
    .eq("entity_type", "series");
  check("read follows for blanket invalidation", error);
  const ids = [...new Set((data ?? []).map((f) => f.entity_id))];
  return invalidate("series", ids);
}

/**
 * Applies one hour(ish) of the provider's change feed to our copy:
 * invalidate what changed, stamp what was deleted, repoint what was merged.
 * Refetching is deliberately NOT done here — nulling fetched_at hands the
 * work to the existing machinery (the sweep for followed series, the
 * page-view path for everything else), so this stays cheap no matter how
 * noisy the feed is. Idempotent; safe to re-run over the same window.
 */
export async function runMetadataSync(): Promise<SyncReport> {
  const supabase = createServiceClient();
  const startedAt = new Date();

  const { data: state, error: stateError } = await supabase
    .from("sync_state")
    .select("cursor_at")
    .eq("provider", PROVIDER)
    .maybeSingle();
  check("read cursor", stateError);

  if (!state) {
    // First run: start the feed here and now. No backfill through /updates —
    // the sweep already converges the existing catalogue.
    const { error } = await supabase
      .from("sync_state")
      .insert({ provider: PROVIDER, cursor_at: startedAt.toISOString() });
    check("initialize cursor", error);
    return { since: null, initialized: true };
  }

  const cursor = new Date(state.cursor_at).getTime();
  const clamped = startedAt.getTime() - cursor > MAX_LOOKBACK_MS;
  const since = new Date(
    Math.max(cursor - OVERLAP_MS, startedAt.getTime() - MAX_LOOKBACK_MS)
  );

  const { changes, complete } = await getMetadataProvider().changedSince(since);

  // Collapse the feed to the series/movies we might hold. Episode records
  // collapse to their series: ingestion refreshes episodes per-series, and
  // per-episode patching is machinery we don't need.
  const changedSeries = new Set<string>();
  const changedSeriesInternal = new Set<number>(); // resolved locally, no provider id round-trip
  const changedMovies = new Set<string>();
  const orphanEpisodes: string[] = []; // episode records TVDB sent without a seriesId
  const deletes: ProviderChange[] = [];
  const merges: ProviderChange[] = [];
  const skippedMerges: string[] = [];

  for (const change of changes) {
    if (change.method === "delete") {
      if (change.entityType === "episode") {
        // An episode delete/merge reshapes its series; a refetch of the
        // series is the whole remedy. Without a seriesId it resolves below.
        if (change.seriesProviderId) changedSeries.add(change.seriesProviderId);
        else orphanEpisodes.push(change.providerId);
      } else if (change.mergeToId) {
        merges.push(change);
      } else {
        deletes.push(change);
      }
      continue;
    }

    if (change.entityType === "series") changedSeries.add(change.providerId);
    else if (change.entityType === "movie") changedMovies.add(change.providerId);
    else if (change.seriesProviderId) changedSeries.add(change.seriesProviderId);
    else orphanEpisodes.push(change.providerId);
  }

  // TVDB omits seriesId on a minority of episode records; we hold our own
  // episode → series mapping, so resolve the held ones locally.
  if (orphanEpisodes.length > 0) {
    const heldEpisodes = await heldIds("episode", orphanEpisodes);
    const episodeIds = [...heldEpisodes.values()];
    for (let i = 0; i < episodeIds.length; i += 200) {
      const { data, error } = await supabase
        .from("episodes")
        .select("series_id")
        .in("id", episodeIds.slice(i, i + 200));
      check("resolve orphan episodes", error);
      // These are internal series ids already — invalidate directly later
      // by faking a held-map entry keyed on the internal id.
      for (const row of data ?? []) changedSeriesInternal.add(row.series_id);
    }
  }

  const heldSeries = await heldIds("series", [...changedSeries]);
  const heldMovies = await heldIds("movie", [...changedMovies]);

  const seriesToInvalidate = new Set([...heldSeries.values(), ...changedSeriesInternal]);

  // Merges: the survivor takes over the loser's external_ids row, then a
  // refetch fills the row with the survivor's data. Internal id — and every
  // follow/watch/rating hanging off it — is untouched. If we hold BOTH
  // sides, two internal rows must become one, which means moving user data;
  // that is deliberately not automated yet (docs/plans/metadata-updates.md)
  // — log it for a human instead.
  let merged = 0;
  for (const entityType of ["series", "movie"] as const) {
    const ofType = merges.filter((m) => m.entityType === entityType);
    if (ofType.length === 0) continue;
    const mergeSources = await heldIds(entityType, ofType.map((m) => m.providerId));
    const mergeTargets = await heldIds(entityType, ofType.map((m) => m.mergeToId!));
    for (const merge of ofType) {
      const sourceInternal = mergeSources.get(merge.providerId);
      if (sourceInternal == null) continue; // not held: nothing to do
      if (mergeTargets.has(merge.mergeToId!)) {
        skippedMerges.push(
          `${entityType} ${merge.providerId} → ${merge.mergeToId} (both held: internal ${sourceInternal} and ${mergeTargets.get(merge.mergeToId!)})`
        );
        continue;
      }
      const { error } = await supabase
        .from("external_ids")
        .update({ provider_id: merge.mergeToId! })
        .eq("provider", PROVIDER)
        .eq("entity_type", entityType)
        .eq("provider_id", merge.providerId);
      check("repoint merged id", error);
      merged++;
      if (entityType === "series") seriesToInvalidate.add(sourceInternal);
      else await invalidate("movies", [sourceInternal]);
    }
  }

  // Plain deletes, held ones only: stamp fresh, never refetch, never drop.
  const deletedSeries = await heldIds(
    "series",
    deletes.filter((d) => d.entityType === "series").map((d) => d.providerId)
  );
  const deletedMovies = await heldIds(
    "movie",
    deletes.filter((d) => d.entityType === "movie").map((d) => d.providerId)
  );
  for (const id of deletedSeries.values()) seriesToInvalidate.delete(id);
  const deleted =
    (await stampDeleted("series", [...deletedSeries.values()])) +
    (await stampDeleted("movies", [...deletedMovies.values()]));

  const invalidatedSeries = await invalidate("series", [...seriesToInvalidate]);
  const invalidatedMovies = await invalidate("movies", [
    ...new Set(heldMovies.values()),
  ]);

  // An incomplete read (page budget) or a clamped cursor may have missed
  // changes. The blunt, safe remedy: treat every followed series as changed.
  // Unfollowed titles and movies fall back to the 12h on-open window, which
  // is exactly the pre-sync status quo.
  if (!complete || clamped) {
    await invalidateAllFollowedSeries();
    console.error(
      `Metadata sync window unreliable (complete=${complete}, clamped=${clamped}); invalidated all followed series`
    );
  }

  // Advance to the run's start, not the newest record seen: anything written
  // while we read lands after startedAt and is the next run's window.
  const { error: cursorError } = await supabase
    .from("sync_state")
    .update({ cursor_at: startedAt.toISOString(), updated_at: new Date().toISOString() })
    .eq("provider", PROVIDER);
  check("advance cursor", cursorError);

  if (skippedMerges.length > 0) {
    console.error(`Metadata sync skipped merges needing a human: ${skippedMerges.join("; ")}`);
  }

  return {
    since: since.toISOString(),
    records: changes.length,
    invalidatedSeries,
    invalidatedMovies,
    deleted,
    merged,
    skippedMerges,
    complete: complete && !clamped,
  };
}
