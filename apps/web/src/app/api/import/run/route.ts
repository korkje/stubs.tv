import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/service";
import {
  ensureMovieIngested,
  ensureSeriesIngested,
} from "@/lib/metadata/ingest";
import { getMetadataProvider } from "@/lib/metadata/provider";
import { normaliseTitle, yearsClose } from "@/lib/import/match";
import type { ImportCounts } from "@/lib/import/types";
import { jobClock } from "@/lib/import/clock";
import { isCronRequest } from "@/lib/cron-auth";

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
 * with everything. Open jobs split each invocation evenly, oldest first
 * (lib/import/clock.ts), so one big import can't keep newer ones waiting.
 * Every step is idempotent, so a crash anywhere re-runs.
 */
const DEADLINE_MS = 20_000;
/** Held back at every checkpoint for the step already in flight. */
const RESERVE_MS = 5_000;
/** Ticks a series or film may fail on before the import gives up on it. */
const MAX_ATTEMPTS = 3;
/** How many series ids to claim from the queue per query. */
const SERIES_PAGE = 20;
const MOVIE_PAGE = 50;

type Service = ReturnType<typeof createServiceClient>;

function check(context: string, error: { message: string } | null): void {
  if (error) throw new Error(`Import worker failed (${context}): ${error.message}`);
}

export async function GET(request: Request) {
  if (!(await isCronRequest(request))) {
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
  const open = jobs ?? [];
  for (const [index, job] of open.entries()) {
    if (timeLeft() < RESERVE_MS) break;
    const clock = jobClock(timeLeft, open.length - index, RESERVE_MS);
    try {
      results.push(await runJob(supabase, job.id, job.counts as unknown as ImportCounts, clock));
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

  // A title the provider keeps failing on must not hold the import open
  // forever: the user can't start another while it is, and can't fix the
  // queue (ADR-0022). Failures count across ticks in counts.failures; an
  // item that failed this tick is skipped for the rest of it, and after
  // MAX_ATTEMPTS ticks it is parked as unmatched, which the reconciliation
  // report (or, for a film, the manual pick) then shows.
  const failures: Record<string, number> = { ...(counts.failures ?? {}) };
  const skippedSeries = new Set<number>();
  const skippedFilms = new Set<number>();

  const saveCounts = async () => {
    // Progress is worth more than shaving writes: the client polls this.
    const { error } = await supabase
      .from("import_jobs")
      .update({
        counts: {
          ...counts,
          seriesDone: Math.min(counts.seriesDone + seriesDone, counts.seriesTotal),
          failures,
        },
      })
      .eq("id", jobId);
    check("update progress", error);
  };

  /** Records a failure; true once the item has used up its attempts. */
  const giveUp = async (key: string, error: unknown): Promise<boolean> => {
    failures[key] = (failures[key] ?? 0) + 1;
    console.error(
      `Import job ${jobId}: ${key} failed (attempt ${failures[key]} of ${MAX_ATTEMPTS}): ` +
        (error instanceof Error ? error.message : String(error))
    );
    await saveCounts();
    return failures[key] >= MAX_ATTEMPTS;
  };

  // --- Episodes: ingest each pending series, then one SQL materialise ----
  for (;;) {
    if (timeLeft() < RESERVE_MS) return partial(jobId, seriesDone, matched, unmatched);
    // Over-fetch by the skipped count, so skipped series never crowd out
    // the ones still worth trying.
    const { data: queue, error: queueError } = await supabase.rpc(
      "import_pending_series",
      { p_job_id: jobId, p_limit: SERIES_PAGE + skippedSeries.size }
    );
    check("read the series queue", queueError);
    const todo = (queue ?? []).filter((e) => !skippedSeries.has(e.series_id));
    if (todo.length === 0) break;

    for (const entry of todo) {
      if (timeLeft() < RESERVE_MS) return partial(jobId, seriesDone, matched, unmatched);
      try {
        // No-ops when fresh (< 12h), so retries after a crash are cheap.
        await ensureSeriesIngested(entry.series_id);
      } catch (error) {
        if (!(await giveUp(`series:${entry.series_id}`, error))) {
          skippedSeries.add(entry.series_id);
          continue;
        }
        const { error: parkError } = await supabase
          .from("import_watch_intents")
          .update({ status: "unmatched" })
          .eq("job_id", jobId)
          .eq("series_id", entry.series_id)
          .eq("status", "pending");
        check("park a series the provider keeps failing on", parkError);
        seriesDone++;
        await saveCounts();
        continue;
      }
      const { data, error } = await supabase.rpc("import_materialise_series", {
        p_job_id: jobId,
        p_series_id: entry.series_id,
      });
      check("materialise a series", error);
      const outcome = (data ?? {}) as { matched?: number; unmatched?: number };
      matched += outcome.matched ?? 0;
      unmatched += outcome.unmatched ?? 0;
      seriesDone++;
      await saveCounts();
    }
  }
  // Skipped series still have pending episodes: not done yet, and the next
  // tick tries them again.
  if (skippedSeries.size > 0) return partial(jobId, seriesDone, matched, unmatched);

  // --- Films ----------------------------------------------------------------
  let moviesMatched = 0;
  let moviesUnmatched = 0;
  for (;;) {
    if (timeLeft() < RESERVE_MS) return partial(jobId, seriesDone, matched, unmatched);
    const { data: movies, error: moviesError } = await supabase
      .from("import_movie_intents")
      .select("id, user_id, name, year, tvdb_movie_id, movie_id, watched_at")
      .eq("job_id", jobId)
      .eq("status", "pending")
      .order("id", { ascending: true })
      .limit(MOVIE_PAGE + skippedFilms.size);
    check("read the film queue", moviesError);
    const todo = (movies ?? []).filter((m) => !skippedFilms.has(m.id));
    if (todo.length === 0) break;

    for (const movie of todo) {
      if (timeLeft() < RESERVE_MS) return partial(jobId, seriesDone, matched, unmatched);
      let movieId: number | null;
      try {
        movieId = movie.movie_id ?? (await autoMatchMovie(supabase, movie));
        if (movieId !== null) await ensureMovieIngested(movieId);
      } catch (error) {
        if (!(await giveUp(`film:${movie.id}`, error))) {
          skippedFilms.add(movie.id);
          continue;
        }
        // Given up: it waits for the manual pick, like a film with no match.
        movieId = null;
      }
      if (movieId === null) {
        const { error } = await supabase
          .from("import_movie_intents")
          .update({ status: "unmatched" })
          .eq("id", movie.id);
        check("park an unmatched film", error);
        moviesUnmatched++;
        continue;
      }
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
  if (skippedFilms.size > 0) return partial(jobId, seriesDone, matched, unmatched);

  const { error: finishError } = await supabase
    .from("import_jobs")
    .update({
      status: "done",
      finished_at: new Date().toISOString(),
      counts: { ...counts, seriesDone: counts.seriesTotal, failures },
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
