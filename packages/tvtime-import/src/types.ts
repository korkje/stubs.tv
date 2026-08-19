// The normalised import payload — the only thing that ever leaves the
// browser (ADR-0015). Format-specific readers (GDPR CSV, Liberator JSON)
// each produce this shape; the commit path never learns which service the
// data came from. Everything here is either a TheTVDB id, a number, a
// timestamp, or a title — no credentials, no tokens, no account data.

/** Which reader produced the payload, and which files it actually used. */
export type ImportSource = "tvtime-gdpr-csv" | "tvtime-liberator-json";

export interface ImportedShow {
  /** TheTVDB series id — the export's `tv_show_id` / `s_id`. */
  tvdb: number;
  name: string;
  /** TV Time state: actively followed and not archived. */
  followed: boolean;
  archived: boolean;
  /** The show rating from `tv_show_rate.csv`, 1–10, or null. */
  rating: number | null;
}

export interface ImportedWatch {
  tvdb: number;
  season: number;
  episode: number;
  /**
   * ISO timestamp of the *earliest* watch. TV Time's `created_at` is when
   * the check-in was recorded, not necessarily when the episode was seen —
   * bulk-marked seasons share one minute. Null when the export had none.
   */
  watchedAt: string | null;
  /** Extra watches beyond the first, so rewatch history can backfill later. */
  rewatchCount: number;
}

export interface ImportedMovie {
  /** Title + year is all the GDPR export carries for films — no ids. */
  name: string;
  year: number | null;
  /** Minutes; the export stores seconds. */
  runtimeMin: number | null;
  watchedAt: string | null;
  /** True for `type=towatch` rows — on the list, not seen. */
  watchlisted: boolean;
  /** Present only in Liberator exports, which do carry movie TVDB ids. */
  tvdb: number | null;
}

export interface ImportPayload {
  source: ImportSource;
  shows: ImportedShow[];
  watches: ImportedWatch[];
  movies: ImportedMovie[];
  /**
   * TV Time's own per-show seen counter (`nb_episodes_seen`), keyed by TVDB
   * series id. Kept solely to reconcile after ingestion: imported vs what
   * TV Time itself claimed, so shortfalls are visible instead of silent.
   */
  reported: Record<string, number>;
}

/** One skipped input row, kept so the UI can say exactly what was dropped. */
export interface SkippedRow {
  file: string;
  /** 1-based line number in the source file where known. */
  line: number | null;
  reason: string;
}

export interface ParseReport {
  /** Files the reader actually consumed, in the order it read them. */
  filesUsed: string[];
  /** Recognised files that were present but empty or superseded. */
  filesIgnored: string[];
  skipped: SkippedRow[];
  /** Episode rows that came from the v1 file because v2 was absent. */
  usedV1Fallback: boolean;
}

export interface ParseResult {
  payload: ImportPayload;
  report: ParseReport;
}

/**
 * Thrown when the archive contains none of the files any reader knows.
 * Distinct from an empty history: importing nothing must never be reported
 * as success (docs/plans/tvtime-import.md — format-generation risk).
 */
export class UnrecognisedExportError extends Error {
  /** Filenames that were offered, for the error UI. */
  readonly offered: string[];

  constructor(offered: string[]) {
    super(
      "No recognised TV Time files found. Expected CSVs like " +
        "tracking-prod-records-v2.csv or followed_tv_show.csv, or a " +
        "TV Time Liberator JSON file."
    );
    this.name = "UnrecognisedExportError";
    this.offered = offered;
  }
}
