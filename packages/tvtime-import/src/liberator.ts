// Reader for the "TV Time Liberator" JSON that the TV Time Out browser
// extension produced before the shutdown. Strictly richer input than the
// GDPR CSVs: it carries TVDB ids for movies too, and per-episode ratings —
// but it has no `nb_episodes_seen`, so the reconciliation map stays empty.

import type {
  ImportedMovie,
  ImportedShow,
  ImportedWatch,
  ImportPayload,
  ParseResult,
  SkippedRow,
} from "./types";

interface LiberatorEpisode {
  id?: { tvdb?: number | null };
  number?: number;
  is_watched?: boolean;
  watched_at?: string | null;
}

interface LiberatorSeason {
  number?: number;
  episodes?: LiberatorEpisode[];
}

interface LiberatorShow {
  id?: { tvdb?: number | null };
  title?: string;
  status?: string;
  rating?: number | null;
  seasons?: LiberatorSeason[];
}

interface LiberatorMovie {
  id?: { tvdb?: number | null };
  title?: string;
  is_watched?: boolean;
  watched_at?: string | null;
  year?: number | null;
  runtime?: number | null;
}

// A datetime with no offset ("2022-01-05 21:00:00") would otherwise be read
// in this machine's zone — the browser's, since parsing happens client-side —
// so the same archive would store different instants depending on the device.
const NAIVE_DATETIME = /^\d{4}-\d{2}-\d{2}[ T]\d{2}:\d{2}(:\d{2})?(\.\d+)?$/;

function toIso(value: unknown): string | null {
  if (typeof value !== "string" || !value.trim()) return null;
  const v = value.trim();
  const ms = Date.parse(NAIVE_DATETIME.test(v) ? `${v.replace(" ", "T")}Z` : v);
  if (Number.isNaN(ms)) return null;
  return new Date(ms).toISOString().replace(/\.\d{3}Z$/, "Z");
}

/**
 * Does this parsed JSON look like a Liberator export? Accepts both the bare
 * array-of-shows shape and a `{ shows, movies }` wrapper, since the
 * extension's output varied across versions.
 */
export function looksLikeLiberator(json: unknown): boolean {
  const shows = Array.isArray(json)
    ? json
    : (json as { shows?: unknown })?.shows;
  if (!Array.isArray(shows) || shows.length === 0) return false;
  const first = shows[0] as LiberatorShow;
  return (
    typeof first === "object" &&
    first !== null &&
    typeof first.id?.tvdb === "number" &&
    Array.isArray(first.seasons)
  );
}

export function parseLiberatorJson(json: unknown): ParseResult {
  const showsIn: LiberatorShow[] = Array.isArray(json)
    ? json
    : ((json as { shows?: LiberatorShow[] }).shows ?? []);
  const moviesIn: LiberatorMovie[] = Array.isArray(json)
    ? []
    : ((json as { movies?: LiberatorMovie[] }).movies ?? []);

  const shows: ImportedShow[] = [];
  const watches: ImportedWatch[] = [];
  const movies: ImportedMovie[] = [];
  const skipped: SkippedRow[] = [];

  for (const s of showsIn) {
    const tvdb = s.id?.tvdb;
    if (typeof tvdb !== "number") {
      skipped.push({
        file: "liberator.json",
        line: null,
        reason: `show ${s.title ? `"${s.title}"` : "(untitled)"} has no TVDB id`,
      });
      continue;
    }
    // Liberator's `status` is the user's own tracking state. "stopped" maps
    // onto TV Time's archive semantics: keep the history, don't follow.
    const status = (s.status ?? "").toLowerCase().replace(/[_-]/g, " ");
    const stopped = status === "stopped";
    const rating =
      typeof s.rating === "number" &&
      Number.isInteger(s.rating) &&
      s.rating >= 1 &&
      s.rating <= 10
        ? s.rating
        : null;
    shows.push({
      tvdb,
      name: s.title ?? "",
      followed: !stopped,
      archived: stopped,
      rating,
    });
    for (const season of s.seasons ?? []) {
      if (typeof season.number !== "number") continue;
      for (const ep of season.episodes ?? []) {
        if (!ep.is_watched || typeof ep.number !== "number") continue;
        watches.push({
          tvdb,
          season: season.number,
          episode: ep.number,
          watchedAt: toIso(ep.watched_at),
          rewatchCount: 0,
        });
      }
    }
  }

  for (const m of moviesIn) {
    if (!m.title) continue;
    movies.push({
      name: m.title,
      year: typeof m.year === "number" ? m.year : null,
      runtimeMin: typeof m.runtime === "number" && m.runtime > 0 ? m.runtime : null,
      watchedAt: m.is_watched ? toIso(m.watched_at) : null,
      watchlisted: !m.is_watched,
      tvdb: typeof m.id?.tvdb === "number" ? m.id.tvdb : null,
    });
  }

  const payload: ImportPayload = {
    source: "tvtime-liberator-json",
    shows,
    watches,
    movies,
    reported: {},
  };
  return {
    payload,
    report: {
      filesUsed: ["liberator.json"],
      filesIgnored: [],
      skipped,
      usedV1Fallback: false,
    },
  };
}
