// Reader for the TV Time GDPR export (the password-protected ZIP of CSVs).
// Column semantics follow docs/plans/tvtime-import.md — "What the export
// actually is" — which was cross-checked against three independent parsers.
// Everything here is defensive: not all accounts got all files, columns are
// sometimes empty, and no new export can ever be generated to test against.

import { parseCsv, type CsvRow } from "./csv";
import type {
  ImportedMovie,
  ImportedShow,
  ImportedWatch,
  ImportPayload,
  ParseReport,
  ParseResult,
  SkippedRow,
} from "./types";

/**
 * The only GDPR-export filenames the importer will read, ever. The ZIP also
 * carries the user's password hash, live auth tokens, IP history and device
 * identifiers — those files must never be opened, so the client unzips
 * strictly against this list (ADR-0015).
 */
export const GDPR_FILE_ALLOWLIST = [
  "followed_tv_show.csv",
  "tracking-prod-records-v2.csv",
  "tracking-prod-records.csv",
  "user_tv_show_data.csv",
  "tv_show_rate.csv",
] as const;

export type GdprFileName = (typeof GDPR_FILE_ALLOWLIST)[number];

/** "2019-01-01 10:00:00" (naive UTC) → ISO; empty/garbage → null. */
function toIso(value: string | undefined): string | null {
  const v = value?.trim();
  if (!v) return null;
  const m = v.match(/^(\d{4})-(\d{2})-(\d{2})[ T](\d{2}):(\d{2}):(\d{2})/);
  if (!m) return null;
  const iso = `${m[1]}-${m[2]}-${m[3]}T${m[4]}:${m[5]}:${m[6]}Z`;
  return Number.isNaN(Date.parse(iso)) ? null : iso;
}

function toInt(value: string | undefined): number | null {
  const v = value?.trim();
  if (!v) return null;
  const n = Number(v);
  return Number.isInteger(n) ? n : null;
}

/** Earlier of two ISO timestamps, treating null as "unknown" (loses). */
function earlier(a: string | null, b: string | null): string | null {
  if (!a) return b;
  if (!b) return a;
  return a <= b ? a : b;
}

interface ShowState {
  tvdb: number;
  name: string;
  followed: boolean;
  archived: boolean;
  rating: number | null;
}

interface WatchState {
  tvdb: number;
  season: number;
  episode: number;
  watchedAt: string | null;
  /** Physical watch rows seen for this episode; extras are rewatches. */
  occurrences: number;
  /** Largest explicit rewatch_count column value seen. */
  declaredRewatches: number;
}

export function parseGdprCsv(files: Map<string, string>): ParseResult {
  const shows = new Map<number, ShowState>();
  const watches = new Map<string, WatchState>();
  const movies = new Map<string, ImportedMovie>();
  const reported: Record<string, number> = {};
  const skipped: SkippedRow[] = [];
  const filesUsed: string[] = [];
  const filesIgnored: string[] = [];

  const show = (tvdb: number, name?: string): ShowState => {
    let s = shows.get(tvdb);
    if (!s) {
      s = { tvdb, name: "", followed: false, archived: false, rating: null };
      shows.set(tvdb, s);
    }
    if (name && !s.name) s.name = name;
    return s;
  };

  const readFile = (name: GdprFileName): CsvRow[] | null => {
    const text = files.get(name);
    if (text === undefined) return null;
    const { rows, malformed } = parseCsv(text);
    for (const m of malformed) {
      skipped.push({
        file: name,
        line: m.line,
        reason: `malformed row (${m.cellCount} cells, expected ${m.expected})`,
      });
    }
    if (rows.length === 0) {
      filesIgnored.push(name);
      return null;
    }
    filesUsed.push(name);
    return rows;
  };

  // --- followed_tv_show.csv: the follow list ------------------------------
  const followedRows = readFile("followed_tv_show.csv");
  for (const row of followedRows ?? []) {
    const tvdb = toInt(row.cells["tv_show_id"]);
    if (tvdb === null) {
      skipped.push({
        file: "followed_tv_show.csv",
        line: row.line,
        reason: "missing tv_show_id",
      });
      continue;
    }
    const s = show(tvdb, row.cells["tv_show_name"]?.trim());
    s.followed = true;
    if (row.cells["archived"]?.trim() === "1") s.archived = true;
  }

  // --- tracking-prod-records-v2.csv: canonical episode history ------------
  // Rows are discriminated by the `key` prefix. Watches and per-show state
  // are data; `count-*`, `time-count`, `last-episode-watched` and the rest
  // are TV Time's own aggregates and are deliberately not imported.
  const v2Rows = readFile("tracking-prod-records-v2.csv");
  let usedV1Fallback = false;

  const recordWatch = (
    file: string,
    line: number,
    tvdb: number | null,
    season: number | null,
    episode: number | null,
    watchedAt: string | null,
    declaredRewatches: number
  ) => {
    if (tvdb === null || season === null || episode === null) {
      skipped.push({
        file,
        line,
        reason: "watch row without series id, season or episode number",
      });
      return;
    }
    const key = `${tvdb}:${season}:${episode}`;
    const existing = watches.get(key);
    if (existing) {
      existing.occurrences++;
      existing.watchedAt = earlier(existing.watchedAt, watchedAt);
      existing.declaredRewatches = Math.max(
        existing.declaredRewatches,
        declaredRewatches
      );
    } else {
      watches.set(key, {
        tvdb,
        season,
        episode,
        watchedAt,
        occurrences: 1,
        declaredRewatches,
      });
    }
    show(tvdb);
  };

  for (const row of v2Rows ?? []) {
    const key = row.cells["key"] ?? "";
    const isWatch =
      key.startsWith("watch-episode-") || key.startsWith("rewatch-episode-");
    const isState = key.startsWith("user-series-");
    if (!isWatch && !isState) continue; // an aggregate row, by design

    // s_id is the TheTVDB series id; the key itself carries
    // {series}-{season}-{episode} as a fallback for sparse rows.
    const keyParts = key.match(/-(\d+)-(\d+)-(\d+)$/);
    const tvdb =
      toInt(row.cells["s_id"]) ?? (keyParts ? Number(keyParts[1]) : null);

    if (isState) {
      if (tvdb === null) continue;
      const s = show(tvdb, row.cells["series_name"]?.trim());
      if (row.cells["is_followed"]?.trim() === "true") s.followed = true;
      if (row.cells["is_archived"]?.trim() === "true") s.archived = true;
      continue;
    }

    const season =
      toInt(row.cells["season_number"]) ??
      toInt(row.cells["s_no"]) ??
      (keyParts ? Number(keyParts[2]) : null);
    const episode =
      toInt(row.cells["episode_number"]) ??
      toInt(row.cells["ep_no"]) ??
      (keyParts ? Number(keyParts[3]) : null);
    recordWatch(
      "tracking-prod-records-v2.csv",
      row.line,
      tvdb,
      season,
      episode,
      toIso(row.cells["created_at"]),
      toInt(row.cells["rewatch_count"]) ?? 0
    );
    if (tvdb !== null) show(tvdb, row.cells["series_name"]?.trim());
  }

  // --- tracking-prod-records.csv: movies, plus the v1 episode fallback ----
  const v1Rows = readFile("tracking-prod-records.csv");
  for (const row of v1Rows ?? []) {
    const entityType = row.cells["entity_type"]?.trim();
    const type = row.cells["type"]?.trim();

    if (entityType === "movie") {
      // A stray `type=rewatch_count` row exists in real exports — and only
      // watch/follow/towatch carry user intent.
      if (type !== "watch" && type !== "follow" && type !== "towatch") continue;
      const name = row.cells["movie_name"]?.trim();
      if (!name) {
        skipped.push({
          file: "tracking-prod-records.csv",
          line: row.line,
          reason: "movie row without a title",
        });
        continue;
      }
      const release = row.cells["release_date"]?.trim() ?? "";
      // "0001-01-01" is TV Time's "unknown".
      const year =
        release && !release.startsWith("0001-")
          ? (toInt(release.slice(0, 4)) ?? null)
          : null;
      const runtimeSec = toInt(row.cells["runtime"]);
      const mKey = `${name.toLowerCase()}:${year ?? "?"}`;
      const existing = movies.get(mKey);
      const watched = type === "watch";
      // `watch_date` is empty on every watch row in real exports.
      const watchedAt = watched ? toIso(row.cells["created_at"]) : null;
      if (existing) {
        if (watched) {
          existing.watchlisted = false;
          existing.watchedAt = earlier(existing.watchedAt, watchedAt);
        }
      } else {
        movies.set(mKey, {
          name,
          year,
          runtimeMin:
            runtimeSec !== null && runtimeSec > 0
              ? Math.round(runtimeSec / 60)
              : null,
          watchedAt,
          watchlisted: !watched,
          tvdb: null,
        });
      }
      continue;
    }

    // v1 carries a copy of the episode history; v2 has ~35% more rows, so
    // v1 episodes count only when v2 is missing entirely.
    if (v2Rows !== null) continue;
    const isEpisodeRow =
      type === "watch" &&
      row.cells["season_number"]?.trim() &&
      row.cells["episode_number"]?.trim();
    if (!isEpisodeRow) continue;
    usedV1Fallback = true;
    const tvdb = toInt(row.cells["series_id"]);
    recordWatch(
      "tracking-prod-records.csv",
      row.line,
      tvdb,
      toInt(row.cells["season_number"]),
      toInt(row.cells["episode_number"]),
      toIso(row.cells["created_at"]),
      toInt(row.cells["rewatch_count"]) ?? 0
    );
    if (tvdb !== null) show(tvdb, row.cells["series_name"]?.trim());
  }

  // --- user_tv_show_data.csv: TV Time's own seen counts, for validation ---
  for (const row of readFile("user_tv_show_data.csv") ?? []) {
    const tvdb = toInt(row.cells["tv_show_id"]);
    const seen = toInt(row.cells["nb_episodes_seen"]);
    if (tvdb === null || seen === null) continue;
    reported[String(tvdb)] = seen;
  }

  // --- tv_show_rate.csv: the one clean numeric rating ---------------------
  for (const row of readFile("tv_show_rate.csv") ?? []) {
    const tvdb = toInt(row.cells["tv_show_id"]);
    const rating = toInt(row.cells["rating"]);
    if (tvdb === null) continue;
    // Our ratings are 1–10 (DATA-MODEL.md); 0 means "unrated" and anything
    // else out of range is safer dropped than guessed at.
    if (rating === null || rating < 1 || rating > 10) {
      if (rating !== null && rating !== 0) {
        skipped.push({
          file: "tv_show_rate.csv",
          line: row.line,
          reason: `rating ${rating} outside the 1-10 scale`,
        });
      }
      continue;
    }
    show(tvdb).rating = rating;
  }

  if (filesUsed.length === 0) {
    return {
      payload: { source: "tvtime-gdpr-csv", shows: [], watches: [], movies: [], reported: {} },
      report: { filesUsed, filesIgnored, skipped, usedV1Fallback },
    };
  }

  const payload: ImportPayload = {
    source: "tvtime-gdpr-csv",
    shows: [...shows.values()].map((s): ImportedShow => ({
      tvdb: s.tvdb,
      name: s.name,
      followed: s.followed,
      archived: s.archived,
      rating: s.rating,
    })),
    watches: [...watches.values()].map((w): ImportedWatch => ({
      tvdb: w.tvdb,
      season: w.season,
      episode: w.episode,
      watchedAt: w.watchedAt,
      rewatchCount: Math.max(w.occurrences - 1, w.declaredRewatches),
    })),
    movies: [...movies.values()],
    reported,
  };

  return {
    payload,
    report: { filesUsed, filesIgnored, skipped, usedV1Fallback },
  };
}
