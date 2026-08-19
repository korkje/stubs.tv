"use server";

// The TV Time import, phase 1 (docs/plans/tvtime-import.md, ADR-0015).
//
// The browser parsed the archive; what arrives here is only the normalised
// payload. This phase is deliberately cheap and instant: persist the payload
// as intents, apply follows and show ratings, and return the queued counts —
// no provider calls. The expensive half (metadata ingestion, episode joins)
// belongs to the background worker at /api/import/run.

import type {
  ImportPayload,
  ImportedMovie,
  ImportedShow,
  ImportedWatch,
  ParseReport,
} from "@stubs/tvtime-import";
import { getMetadataProvider } from "@/lib/metadata/provider";
import { ensureMovieIngested } from "@/lib/metadata/ingest";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { requireWriteAccess } from "@/lib/plan";
import { kickImportWorker } from "./kick";
import type { ImportCounts, ImportStatus, MovieCandidate } from "./types";

function fail(context: string, error: { message: string } | null): void {
  if (error) throw new Error(`Could not ${context}: ${error.message}`);
}

// Abuse bounds, not product limits: the biggest real TV Time libraries seen
// in prior importers are far below these. Oversized payloads are rejected,
// never truncated — silent truncation would masquerade as a clean import.
const MAX_SHOWS = 5_000;
const MAX_WATCHES = 150_000;
const MAX_MOVIES = 10_000;
/** PostgREST insert batches; also the unit of progress during commit. */
const CHUNK = 1_000;

const isInt = (v: unknown): v is number =>
  typeof v === "number" && Number.isInteger(v);

const isoOrNull = (v: unknown): string | null =>
  typeof v === "string" && !Number.isNaN(Date.parse(v))
    ? new Date(v).toISOString()
    : null;

/**
 * Actions are a public endpoint, so the payload is re-validated here even
 * though our own client just built it. Bad rows throw rather than skip:
 * the parser already filtered, so anything malformed at this point is not
 * a scruffy CSV, it is a forged request.
 */
function validatePayload(payload: ImportPayload): {
  shows: ImportedShow[];
  watches: ImportedWatch[];
  movies: ImportedMovie[];
  reported: Record<string, number>;
  source: string;
} {
  if (
    payload.source !== "tvtime-gdpr-csv" &&
    payload.source !== "tvtime-liberator-json"
  ) {
    throw new Error("Unknown import source");
  }
  const { shows, watches, movies } = payload;
  if (!Array.isArray(shows) || shows.length > MAX_SHOWS)
    throw new Error(`Import too large: over ${MAX_SHOWS} shows`);
  if (!Array.isArray(watches) || watches.length > MAX_WATCHES)
    throw new Error(`Import too large: over ${MAX_WATCHES} episodes`);
  if (!Array.isArray(movies) || movies.length > MAX_MOVIES)
    throw new Error(`Import too large: over ${MAX_MOVIES} films`);

  for (const s of shows) {
    if (!isInt(s.tvdb) || s.tvdb <= 0) throw new Error("Invalid show id");
    if (typeof s.name !== "string") throw new Error("Invalid show name");
    if (s.rating !== null && (!isInt(s.rating) || s.rating < 1 || s.rating > 10))
      throw new Error("Invalid show rating");
  }
  for (const w of watches) {
    if (!isInt(w.tvdb) || w.tvdb <= 0) throw new Error("Invalid watch row");
    if (!isInt(w.season) || w.season < 0 || w.season > 1000)
      throw new Error("Invalid season number");
    if (!isInt(w.episode) || w.episode < 0 || w.episode > 20000)
      throw new Error("Invalid episode number");
  }
  for (const m of movies) {
    if (typeof m.name !== "string" || !m.name.trim() || m.name.length > 500)
      throw new Error("Invalid film title");
    if (m.tvdb !== null && (!isInt(m.tvdb) || m.tvdb <= 0))
      throw new Error("Invalid film id");
  }
  const reported: Record<string, number> = {};
  if (payload.reported && typeof payload.reported === "object") {
    for (const [key, value] of Object.entries(payload.reported)) {
      if (/^\d+$/.test(key) && isInt(value) && value >= 0) reported[key] = value;
    }
  }
  return {
    shows: shows.map((s) => ({ ...s, name: s.name.slice(0, 500) })),
    watches,
    movies,
    reported,
    source: payload.source,
  };
}

export interface CommitResult {
  jobId: number;
  counts: ImportCounts;
}

export async function commitImport(
  rawPayload: ImportPayload,
  report: ParseReport
): Promise<CommitResult> {
  const { supabase, userId } = await requireWriteAccess();
  const payload = validatePayload(rawPayload);

  // Resolve every TVDB id to an internal id in one RPC — the same batch
  // call search uses. It creates stub rows as needed, so from here on the
  // import speaks internal ids only (AGENTS.md rule 6). The service client
  // is required (the RPC is service-role-only) and sanctioned: this is
  // ingestion's front door, not a bypass of RLS — every user-data write
  // below goes through the authenticated client.
  const shows = new Map(payload.shows.map((s) => [s.tvdb, s]));
  for (const w of payload.watches) {
    if (!shows.has(w.tvdb)) {
      shows.set(w.tvdb, {
        tvdb: w.tvdb,
        name: "",
        followed: false,
        archived: false,
        rating: null,
      });
    }
  }
  const service = createServiceClient();
  const entities = [
    ...[...shows.values()].map((s) => ({
      entity_type: "series",
      provider_id: String(s.tvdb),
      name: s.name || `TVDB series ${s.tvdb}`,
    })),
    // Liberator exports carry movie TVDB ids; those films skip the
    // title-match dance entirely.
    ...payload.movies
      .filter((m) => m.tvdb !== null && !m.watchlisted)
      .map((m) => ({
        entity_type: "movie",
        provider_id: String(m.tvdb),
        name: m.name,
      })),
  ];
  const resolved = new Map<string, number>();
  for (let i = 0; i < entities.length; i += CHUNK) {
    const { data, error } = await service.rpc("resolve_entities", {
      p_provider: "tvdb",
      p_entities: entities.slice(i, i + CHUNK),
    });
    fail("resolve the import's titles", error);
    for (const [key, id] of Object.entries(
      (data ?? {}) as Record<string, number>
    )) {
      resolved.set(key, id);
    }
  }
  const seriesId = (tvdb: number) => resolved.get(`series:${tvdb}`);

  const watchedMovies = payload.movies.filter((m) => !m.watchlisted);
  const distinctSeries = new Set(payload.watches.map((w) => w.tvdb));
  const follows = payload.shows.filter((s) => s.followed && !s.archived);
  const ratings = payload.shows.filter((s) => s.rating !== null);

  const counts: ImportCounts = {
    shows: shows.size,
    episodes: payload.watches.length,
    movies: watchedMovies.length,
    moviesWatchlisted: payload.movies.length - watchedMovies.length,
    follows: follows.length,
    ratings: ratings.length,
    seriesTotal: distinctSeries.size,
    seriesDone: 0,
  };

  // The job row. The partial unique index enforces one open import per
  // account; surface that as a sentence, not a Postgres error.
  const { data: job, error: jobError } = await supabase
    .from("import_jobs")
    .insert({
      user_id: userId,
      source: payload.source,
      status: "queued",
      counts: { ...counts },
      reported: payload.reported,
      report: JSON.parse(JSON.stringify(report)),
    })
    .select("id")
    .single();
  if (jobError?.code === "23505") {
    throw new Error(
      "An import is already in progress — let it finish before starting another."
    );
  }
  fail("create the import job", jobError);
  const jobId = job!.id;

  // Intents: the payload persisted verbatim, before any provider call.
  // This is the safety net — an episode TheTVDB has since renumbered stays
  // here as a reportable row instead of vanishing.
  const intentRows = payload.watches.flatMap((w) => {
    const sid = seriesId(w.tvdb);
    if (sid === undefined) return [];
    return [
      {
        job_id: jobId,
        user_id: userId,
        series_id: sid,
        tvdb_series_id: w.tvdb,
        season_number: w.season,
        episode_number: w.episode,
        watched_at: isoOrNull(w.watchedAt),
        rewatch_count: w.rewatchCount,
      },
    ];
  });
  for (let i = 0; i < intentRows.length; i += CHUNK) {
    const { error } = await supabase
      .from("import_watch_intents")
      .upsert(intentRows.slice(i, i + CHUNK), {
        onConflict: "job_id,tvdb_series_id,season_number,episode_number",
        ignoreDuplicates: true,
      });
    fail("queue the episode history", error);
  }

  const movieRows = watchedMovies.map((m) => ({
    job_id: jobId,
    user_id: userId,
    name: m.name.slice(0, 500),
    year: m.year,
    runtime_min: m.runtimeMin,
    tvdb_movie_id: m.tvdb,
    watched_at: isoOrNull(m.watchedAt),
    ...(m.tvdb !== null && resolved.has(`movie:${m.tvdb}`)
      ? { movie_id: resolved.get(`movie:${m.tvdb}`) }
      : {}),
  }));
  for (let i = 0; i < movieRows.length; i += CHUNK) {
    const { error } = await supabase
      .from("import_movie_intents")
      .insert(movieRows.slice(i, i + CHUNK));
    fail("queue the films", error);
  }

  // Follows, applied now so the up-next feed starts filling as soon as the
  // worker ingests. Only what TV Time had *actively* followed: archived
  // shows import their history but do not follow — following 300 finished
  // shows would wreck the feed, and every follow is refreshed hourly
  // forever (ADR-0010), so this is also the recurring-cost boundary.
  const followRows = follows.flatMap((s) => {
    const sid = seriesId(s.tvdb);
    if (sid === undefined) return [];
    return [{ user_id: userId, entity_type: "series" as const, entity_id: sid }];
  });
  for (let i = 0; i < followRows.length; i += CHUNK) {
    const { error } = await supabase
      .from("follows")
      .upsert(followRows.slice(i, i + CHUNK), {
        onConflict: "user_id,entity_type,entity_id",
        ignoreDuplicates: true,
      });
    fail("apply the follows", error);
  }

  // Show ratings. ignoreDuplicates: a rating set in this app outranks the
  // imported one — re-running an import must never clobber later opinions.
  const ratingRows = ratings.flatMap((s) => {
    const sid = seriesId(s.tvdb);
    if (sid === undefined) return [];
    return [
      {
        user_id: userId,
        entity_type: "series" as const,
        entity_id: sid,
        score: s.rating!,
      },
    ];
  });
  for (let i = 0; i < ratingRows.length; i += CHUNK) {
    const { error } = await supabase
      .from("ratings")
      .upsert(ratingRows.slice(i, i + CHUNK), {
        onConflict: "user_id,entity_type,entity_id",
        ignoreDuplicates: true,
      });
    fail("apply the show ratings", error);
  }

  await kickImportWorker();
  return { jobId, counts };
}

/**
 * The user's latest import, with live intent tallies for the progress bar.
 * Read-only and RLS-scoped; polled by the client while a job is open, so
 * it deliberately performs no writes and no revalidation.
 */
export async function getImportStatus(): Promise<ImportStatus | null> {
  const supabase = await createClient();
  const { data: job, error } = await supabase
    .from("import_jobs")
    .select("id, source, status, counts, created_at, finished_at")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  fail("load the import status", error);
  if (!job) return null;

  const tally = async (
    table: "import_watch_intents" | "import_movie_intents",
    status: string
  ) => {
    const { count, error: countError } = await supabase
      .from(table)
      .select("id", { count: "exact", head: true })
      .eq("job_id", job.id)
      .eq("status", status);
    fail("count the import progress", countError);
    return count ?? 0;
  };

  const [
    episodesPending,
    episodesMatched,
    episodesUnmatched,
    moviesPending,
    moviesMatched,
    moviesUnmatched,
    moviesSkipped,
  ] = await Promise.all([
    tally("import_watch_intents", "pending"),
    tally("import_watch_intents", "matched"),
    tally("import_watch_intents", "unmatched"),
    tally("import_movie_intents", "pending"),
    tally("import_movie_intents", "matched"),
    tally("import_movie_intents", "unmatched"),
    tally("import_movie_intents", "skipped"),
  ]);

  return {
    jobId: job.id,
    source: job.source,
    status: job.status as ImportStatus["status"],
    counts: job.counts as unknown as ImportCounts,
    createdAt: job.created_at,
    finishedAt: job.finished_at,
    episodesPending,
    episodesMatched,
    episodesUnmatched,
    moviesPending,
    moviesMatched,
    moviesUnmatched,
    moviesSkipped,
  };
}

/**
 * Candidates for a manual film pick: TVDB search, top few with posters.
 * Write-gated like the rest of the import — it spends provider calls.
 */
export async function searchMovieCandidates(
  intentId: number
): Promise<MovieCandidate[]> {
  const { supabase } = await requireWriteAccess();
  const { data: intent, error } = await supabase
    .from("import_movie_intents")
    .select("name, year")
    .eq("id", intentId)
    .maybeSingle();
  fail("load the film", error);
  if (!intent) throw new Error("Film not found");

  const provider = getMetadataProvider();
  const results = await provider.search(intent.name, { limit: 12 });
  return results
    .filter((r) => r.kind === "movie")
    .slice(0, 4)
    .map((r) => ({
      providerId: r.providerId,
      name: r.name,
      year: r.year,
      posterUrl: r.posterUrl,
    }));
}

/** The user picked a candidate: resolve it, ingest it, write the watch. */
export async function resolveMovieIntent(
  intentId: number,
  providerId: string,
  name: string
): Promise<void> {
  const { supabase, userId } = await requireWriteAccess();
  if (!/^\d+$/.test(providerId)) throw new Error("Invalid film id");

  const { data: intent, error } = await supabase
    .from("import_movie_intents")
    .select("id, watched_at, status")
    .eq("id", intentId)
    .maybeSingle();
  fail("load the film", error);
  if (!intent) throw new Error("Film not found");

  const service = createServiceClient();
  const { data, error: rpcError } = await service.rpc("resolve_entities", {
    p_provider: "tvdb",
    p_entities: [
      { entity_type: "movie", provider_id: providerId, name: name.slice(0, 500) },
    ],
  });
  fail("resolve the film", rpcError);
  const movieId = ((data ?? {}) as Record<string, number>)[
    `movie:${providerId}`
  ];
  if (movieId === undefined) throw new Error("Could not resolve the film");

  await ensureMovieIngested(movieId);

  const { error: watchError } = await supabase.from("watches").upsert(
    {
      user_id: userId,
      entity_type: "movie",
      entity_id: movieId,
      watched_at: intent.watched_at,
    },
    { onConflict: "user_id,entity_type,entity_id", ignoreDuplicates: true }
  );
  fail("mark the film as seen", watchError);

  const { error: updateError } = await supabase
    .from("import_movie_intents")
    .update({ status: "matched", movie_id: movieId })
    .eq("id", intentId);
  fail("update the film's import row", updateError);
}

/** The user chose to drop an unmatched film. */
export async function skipMovieIntent(intentId: number): Promise<void> {
  const { supabase } = await requireWriteAccess();
  const { error } = await supabase
    .from("import_movie_intents")
    .update({ status: "skipped" })
    .eq("id", intentId)
    .in("status", ["pending", "unmatched"]);
  fail("skip the film", error);
}
