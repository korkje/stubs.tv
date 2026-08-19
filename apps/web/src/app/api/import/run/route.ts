import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/service";
import {
  ensureMovieIngested,
  ensureSeriesIngested,
} from "@/lib/metadata/ingest";
import { getMetadataProvider } from "@/lib/metadata/provider";
import { normaliseTitle, yearsClose } from "@/lib/import/match";
import type { ImportCounts } from "@/lib/import/types";

/**
 * Phase 2 of the TV Time import (docs/plans/tvtime-import.md §4b): walk each
 * open job's pending series — followed shows first, so the up-next feed
 * becomes useful within minutes — ingest metadata, and materialise intents
 * into watches via one SQL call per series. Then films: Liberator rows with
 * ids resolve directly, GDPR rows get one strict exact-match attempt, and
 * everything else waits for the manual pick on /app/import.
 *
 * Invoked by the 5-minute cron in wrangler.jsonc and nudged once after each
 * commit (lib/import/kick.ts). One invocation usually finishes a whole job
 * on the paid plan; the deadline below makes an oversized job stop cleanly
 * mid-way and resume on the next tick rather than trust a single invocation
 * with everything. Every step is idempotent, so a crash anywhere re-runs.
 */
const DEADLINE_MS = 20_000;
/** How many series ids to claim from the queue per query. */
const SERIES_PAGE = 20;
const MOVIE_PAGE = 50;

type Service = ReturnType<typeof createServiceClient>;

function check(context: string, error: { message: string } | null): void {
  if (error) throw new Error(`Import worker failed (${context}): ${error.message}`);
}

export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret || request.headers.get("x-cron-key") !== secret) {
    return new NextResponse("Unauthorized", { status: 401 });
  }

  const supabase = createServiceClient();
  const startedAt = Date.now();
  const timeLeft = () => DEADLINE_MS - (Date.now() - startedAt);

  const { data: jobs, error: jobsError } = await supabase
    .from("import_jobs")
    .select("id, user_id, status, counts")
    .in("status", ["queued", "running"])
    .order("created_at", { ascending: true });
  if (jobsError) {
    return NextResponse.json({ error: jobsError.message }, { status: 500 });
  }

  const results: Record<string, unknown>[] = [];
  const errors: string[] = [];
  for (const job of jobs ?? []) {
    if (timeLeft() < 2_000) break;
    try {
      results.push(await runJob(supabase, job.id, job.counts as unknown as ImportCounts, timeLeft));
    } catch (error) {
      // Leave the job as-is: everything is idempotent and the next tick
      // picks up exactly where this one stopped.
      errors.push(`job ${job.id}: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  return NextResponse.json(
    { jobs: results, ...(errors.length ? { errors } : {}) },
    { status: errors.length ? 500 : 200 }
  );
}

async function runJob(
  supabase: Service,
  jobId: number,
  counts: ImportCounts,
  timeLeft: () => number
): Promise<Record<string, unknown>> {
  const { error: startError } = await supabase
    .from("import_jobs")
    .update({ status: "running" })
    .eq("id", jobId)
    .eq("status", "queued");
  check("start job", startError);

  let seriesDone = 0;
  let matched = 0;
  let unmatched = 0;

  // --- Episodes: ingest each pending series, then one SQL materialise ----
  for (;;) {
    if (timeLeft() < 5_000) return partial(jobId, seriesDone, matched, unmatched);
    const { data: queue, error: queueError } = await supabase.rpc(
      "import_pending_series",
      { p_job_id: jobId, p_limit: SERIES_PAGE }
    );
    check("read the series queue", queueError);
    if (!queue || queue.length === 0) break;

    for (const entry of queue) {
      if (timeLeft() < 5_000) return partial(jobId, seriesDone, matched, unmatched);
      // No-ops when fresh (< 12h), so retries after a crash are cheap.
      await ensureSeriesIngested(entry.series_id);
      const { data, error } = await supabase.rpc("import_materialise_series", {
        p_job_id: jobId,
        p_series_id: entry.series_id,
      });
      check("materialise a series", error);
      const outcome = (data ?? {}) as { matched?: number; unmatched?: number };
      matched += outcome.matched ?? 0;
      unmatched += outcome.unmatched ?? 0;
      seriesDone++;
      // Progress is worth more than shaving writes: the client polls this.
      const { error: countError } = await supabase
        .from("import_jobs")
        .update({
          counts: {
            ...counts,
            seriesDone: Math.min(counts.seriesDone + seriesDone, counts.seriesTotal),
          },
        })
        .eq("id", jobId);
      check("update progress", countError);
    }
  }

  // --- Films ----------------------------------------------------------------
  let moviesMatched = 0;
  let moviesUnmatched = 0;
  for (;;) {
    if (timeLeft() < 5_000) return partial(jobId, seriesDone, matched, unmatched);
    const { data: movies, error: moviesError } = await supabase
      .from("import_movie_intents")
      .select("id, user_id, name, year, tvdb_movie_id, movie_id, watched_at")
      .eq("job_id", jobId)
      .eq("status", "pending")
      .order("id", { ascending: true })
      .limit(MOVIE_PAGE);
    check("read the film queue", moviesError);
    if (!movies || movies.length === 0) break;

    for (const movie of movies) {
      if (timeLeft() < 5_000) return partial(jobId, seriesDone, matched, unmatched);
      const movieId = movie.movie_id ?? (await autoMatchMovie(supabase, movie));
      if (movieId === null) {
        const { error } = await supabase
          .from("import_movie_intents")
          .update({ status: "unmatched" })
          .eq("id", movie.id);
        check("park an unmatched film", error);
        moviesUnmatched++;
        continue;
      }
      await ensureMovieIngested(movieId);
      const { error: watchError } = await supabase.from("watches").upsert(
        {
          user_id: movie.user_id,
          entity_type: "movie",
          entity_id: movieId,
          watched_at: movie.watched_at,
        },
        { onConflict: "user_id,entity_type,entity_id", ignoreDuplicates: true }
      );
      check("mark a film as seen", watchError);
      const { error: doneError } = await supabase
        .from("import_movie_intents")
        .update({ status: "matched", movie_id: movieId })
        .eq("id", movie.id);
      check("finish a film", doneError);
      moviesMatched++;
    }
  }

  const { error: finishError } = await supabase
    .from("import_jobs")
    .update({
      status: "done",
      finished_at: new Date().toISOString(),
      counts: { ...counts, seriesDone: counts.seriesTotal },
    })
    .eq("id", jobId);
  check("finish job", finishError);

  return {
    jobId,
    done: true,
    seriesDone,
    episodesMatched: matched,
    episodesUnmatched: unmatched,
    moviesMatched,
    moviesUnmatched,
  };
}

function partial(
  jobId: number,
  seriesDone: number,
  matched: number,
  unmatched: number
): Record<string, unknown> {
  return {
    jobId,
    done: false,
    seriesDone,
    episodesMatched: matched,
    episodesUnmatched: unmatched,
  };
}

/**
 * The strict auto-accept from the plan (§3): a single TVDB result whose
 * normalised title matches exactly and whose year is within ±1 — otherwise
 * null, and the film waits for a human. Never a fuzzy guess: a wrong film
 * in someone's history is worse than a missing one, and unlike episodes
 * there is no counter to validate against.
 */
async function autoMatchMovie(
  supabase: Service,
  movie: { name: string; year: number | null }
): Promise<number | null> {
  if (movie.year === null) return null;
  const provider = getMetadataProvider();
  const results = await provider.search(movie.name, { limit: 12 });
  const wanted = normaliseTitle(movie.name);
  const candidates = results.filter(
    (r) => r.kind === "movie" && normaliseTitle(r.name) === wanted
  );
  if (candidates.length !== 1 || !yearsClose(candidates[0].year, movie.year)) {
    return null;
  }
  const hit = candidates[0];
  const { data, error } = await supabase.rpc("resolve_entities", {
    p_provider: "tvdb",
    p_entities: [
      { entity_type: "movie", provider_id: hit.providerId, name: hit.name },
    ],
  });
  check("resolve a film", error);
  return (
    ((data ?? {}) as Record<string, number>)[`movie:${hit.providerId}`] ?? null
  );
}
