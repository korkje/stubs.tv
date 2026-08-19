// Shapes shared between the import actions, the background worker and the
// UI. The jsonb columns on import_jobs are owned here: the database stores
// them opaquely, the app gives them meaning.

/** Lives in import_jobs.counts. Phase 1 writes the totals; the worker
 * advances seriesDone/episodesMatched as it materialises intents. */
export interface ImportCounts {
  shows: number;
  episodes: number;
  movies: number;
  /** TV Time to-watch films — not imported (no watchlist here yet), but
   * the summary must say so rather than let them silently vanish. */
  moviesWatchlisted: number;
  follows: number;
  ratings: number;
  seriesTotal: number;
  seriesDone: number;
}

/** One row of the polled progress/status payload. */
export interface ImportStatus {
  jobId: number;
  source: string;
  status: "queued" | "running" | "done" | "failed";
  counts: ImportCounts;
  createdAt: string;
  finishedAt: string | null;
  /** Live intent tallies, so the progress bar moves between counts writes. */
  episodesPending: number;
  episodesMatched: number;
  episodesUnmatched: number;
  moviesPending: number;
  moviesMatched: number;
  moviesUnmatched: number;
  moviesSkipped: number;
}

/** A TVDB candidate offered for a manual movie pick. */
export interface MovieCandidate {
  providerId: string;
  name: string;
  year: number | null;
  posterUrl: string | null;
}
