/**
 * The filter vocabulary, defined once for both surfaces.
 *
 * State lives entirely in the URL — no client state, no context, no storage.
 * That is what makes every filtered view a shareable link, keeps the pages
 * server components, and lets Next's router cache key each combination
 * separately. Filtering itself happens in SQL, which the 10ms CPU ceiling
 * (ADR-0002) requires: fetching a list and narrowing it in the worker is the
 * shape that returns HTTP 1102 in production.
 *
 * Everything here is total. Values arrive from the URL bar, where anyone can
 * type anything, so a malformed parameter degrades to "no filter" rather
 * than throwing — a bad link should show an unfiltered page, not an error.
 */

/**
 * TheTVDB's own status values, which is what the `series.status` column
 * holds. A closed set, which is what makes it a good facet.
 *
 * The labels are ours. "Continuing" is provider jargon; "Ongoing" is what a
 * viewer would say. "Airing" was the other candidate and is worse — a show
 * between seasons is Continuing but is not airing, so the label would read
 * as false for much of the year.
 */
export const STATUSES = [
  { value: "Continuing", label: "Ongoing" },
  { value: "Ended", label: "Ended" },
  { value: "Upcoming", label: "Upcoming" },
] as const;

export type Status = (typeof STATUSES)[number]["value"];

const STATUS_VALUES = STATUSES.map((s) => s.value) as readonly string[];

/**
 * Each surface's runtime slider, scaled to its material: episodes cluster
 * under an hour, films run past three. One scale for both would waste half
 * the track on one surface or clip the other.
 */
export const RUNTIME_MIN = 0;
export const SHOW_RUNTIME = { label: "Episode length", max: 120, step: 5 } as const;
export const MOVIE_RUNTIME = { label: "Length", max: 240, step: 10 } as const;

export type RuntimeScale = typeof SHOW_RUNTIME | typeof MOVIE_RUNTIME;

/** The range the rating slider spans — scores are 1–10. */
export const RATING_MIN = 1;
export const RATING_MAX = 10;

/**
 * The ends are releases, not clamps: a range touching either end means
 * "unbounded that way", so a 250-minute epic is not hidden by a slider
 * whose track happens to stop at 240. `max` is the calling surface's scale.
 */
export function runtimeBounds(
  runtime: [number, number] | null,
  max: number
): {
  min: number | null;
  max: number | null;
} {
  if (!runtime) return { min: null, max: null };
  const [lo, hi] = runtime;
  return {
    min: lo <= RUNTIME_MIN ? null : lo,
    max: hi >= max ? null : hi,
  };
}

/**
 * `%` and `_` are wildcards inside LIKE, so a user searching for "9_1_1"
 * would otherwise match far more than they asked for. Backslash is
 * Postgres's default LIKE escape.
 */
export function escapeLike(value: string): string {
  return value.replace(/[\\%_]/g, (c) => `\\${c}`);
}

/**
 * Same idea for the rating range, with one asymmetry worth knowing: any
 * active rating bound only matches shows that have a rating at all. "Rated
 * 5 or less" means rated, and at most 5 — not "nothing I loved", which
 * would sweep in everything unrated.
 */
export function ratingBounds(rating: [number, number] | null): {
  min: number | null;
  max: number | null;
} {
  if (!rating) return { min: null, max: null };
  const [lo, hi] = rating;
  if (lo <= RATING_MIN && hi >= RATING_MAX) return { min: null, max: null };
  return {
    min: lo <= RATING_MIN ? null : lo,
    max: hi >= RATING_MAX ? null : hi,
  };
}

export interface Filters {
  /** Free-text match on the title's name. Library only. */
  query: string;
  /**
   * Followed or not. Library only — the feed is followed-only already.
   * Null is "either", which is why this is not a boolean: "not followed"
   * is a real question ("what am I still tracking out of inertia?").
   */
  following: boolean | null;
  /** True: episodes left to watch. False: caught up. Null: either. */
  behind: boolean | null;
  /** One status, or null for all. Single-select on purpose: it keeps the
   * control the same shape as the other choice facets, and no real question
   * here needs two of three statuses at once. */
  status: Status | null;
  /** Personal rating range, 1–10; ends touching the rails are unbounded. */
  rating: [number, number] | null;
  /** Average episode length, in minutes. */
  runtime: [number, number] | null;
  /** Feed only: show episodes already seen, off by default. */
  includeWatched: boolean;
}

export const NO_FILTERS: Filters = {
  query: "",
  following: null,
  behind: null,
  status: null,
  rating: null,
  runtime: null,
  includeWatched: false,
};

/**
 * Sort keys, per surface — the two lists differ where the data does
 * (first-aired vs released, episodes left to watch vs nothing).
 *
 * `defaultAscending` is the direction someone almost certainly means when
 * they pick the key — nobody switches to "My rating" hoping to see their
 * worst titles first. The keys the lists share agree on it, which is what
 * lets serialisation stay surface-blind.
 */
export const SHOW_SORT_KEYS = [
  { value: "name", label: "Name", defaultAscending: true },
  { value: "rating", label: "My rating", defaultAscending: false },
  { value: "first_aired", label: "First aired", defaultAscending: false },
  { value: "runtime_min", label: "Episode length", defaultAscending: true },
  { value: "unwatched_episodes", label: "Left to watch", defaultAscending: false },
] as const;

export const MOVIE_SORT_KEYS = [
  { value: "name", label: "Name", defaultAscending: true },
  { value: "rating", label: "My rating", defaultAscending: false },
  { value: "released", label: "Released", defaultAscending: false },
  { value: "runtime_min", label: "Length", defaultAscending: true },
] as const;

export type SortKey =
  | (typeof SHOW_SORT_KEYS)[number]["value"]
  | (typeof MOVIE_SORT_KEYS)[number]["value"];

export interface SortKeyDef {
  value: SortKey;
  label: string;
  defaultAscending: boolean;
}

export function sortKeyMeta(key: SortKey): SortKeyDef {
  // The find cannot miss: key is typed to the members of the two lists.
  return (
    SHOW_SORT_KEYS.find((s) => s.value === key) ??
    MOVIE_SORT_KEYS.find((s) => s.value === key)!
  );
}

/**
 * One key and a direction. Ties always break on name A–Z implicitly — a
 * visible "then by" control earned its space for exactly one use case
 * ("rating descending, then name"), which the implicit rule covers.
 */
export interface Sort {
  key: SortKey;
  ascending: boolean;
}

export const DEFAULT_SORT: Sort = { key: "name", ascending: true };

type Params = Record<string, string | string[] | undefined>;

/** First value of a repeated parameter, or undefined. */
function one(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

function int(value: string | undefined, lo: number, hi: number): number | null {
  const n = Number.parseInt(value ?? "", 10);
  return Number.isFinite(n) && n >= lo && n <= hi ? n : null;
}

/** "1" → true, "0" → false, anything else → no filter. */
function tri(value: string | undefined): boolean | null {
  if (value === "1") return true;
  if (value === "0") return false;
  return null;
}

/** A half-specified or inverted range is not a range. */
function range(
  lo: number | null,
  hi: number | null
): [number, number] | null {
  return lo !== null && hi !== null && lo <= hi ? [lo, hi] : null;
}

export function parseFilters(params: Params): Filters {
  return {
    query: (one(params.q) ?? "").trim().slice(0, 100),
    following: tri(one(params.following)),
    behind: tri(one(params.behind)),
    status: ((value) => (STATUS_VALUES.includes(value ?? "") ? (value as Status) : null))(
      one(params.status)
    ),
    rating: range(
      int(one(params.rmin), RATING_MIN, RATING_MAX),
      int(one(params.rmax), RATING_MIN, RATING_MAX)
    ),
    // Parsed against the widest scale; each surface's runtimeBounds() call
    // treats anything at or past its own ceiling as unbounded.
    runtime: range(
      int(one(params.rtmin), RUNTIME_MIN, MOVIE_RUNTIME.max),
      int(one(params.rtmax), RUNTIME_MIN, MOVIE_RUNTIME.max)
    ),
    includeWatched: one(params.watched) === "1",
  };
}

export function parseSort(params: Params, keys: readonly SortKeyDef[]): Sort {
  const raw = one(params.sort) ?? "";
  // "rating:desc" — a key with an optional direction. A key without one
  // gets its natural direction, so "?sort=rating" already means highest
  // first. Validated against the calling surface's own keys: a shows sort
  // opened on the movies tab degrades to the default instead of asking
  // PostgREST to order by a column the view does not have.
  const [key, direction] = raw.split(":");

  if (!keys.some((k) => k.value === key)) return DEFAULT_SORT;

  return {
    key: key as SortKey,
    ascending: parseDirection(direction, key as SortKey),
  };
}

function parseDirection(direction: string | undefined, key: SortKey): boolean {
  if (direction === "asc") return true;
  if (direction === "desc") return false;
  return sortKeyMeta(key).defaultAscending;
}

function serializeSortKey(key: SortKey, ascending: boolean): string {
  if (ascending === sortKeyMeta(key).defaultAscending) return key;
  return `${key}:${ascending ? "asc" : "desc"}`;
}

/**
 * Back to a query string, omitting everything at its default so a clean view
 * has a clean URL — `/app/library` rather than `/app/library?q=&status=`.
 */
export function serializeFilters(filters: Filters, sort?: Sort): URLSearchParams {
  const params = new URLSearchParams();

  if (filters.query) params.set("q", filters.query);
  if (filters.following !== null) params.set("following", filters.following ? "1" : "0");
  if (filters.behind !== null) params.set("behind", filters.behind ? "1" : "0");
  if (filters.status) params.set("status", filters.status);
  if (filters.rating) {
    params.set("rmin", String(filters.rating[0]));
    params.set("rmax", String(filters.rating[1]));
  }
  if (filters.runtime) {
    params.set("rtmin", String(filters.runtime[0]));
    params.set("rtmax", String(filters.runtime[1]));
  }
  if (filters.includeWatched) params.set("watched", "1");

  if (
    sort &&
    (sort.key !== DEFAULT_SORT.key || sort.ascending !== DEFAULT_SORT.ascending)
  ) {
    params.set("sort", serializeSortKey(sort.key, sort.ascending));
  }

  return params;
}

/**
 * Which facets each surface offers. The feed gets exactly one: following a
 * show already is the feed's filter, so the only question left there is
 * whether watched episodes stay visible. (The up_next function still
 * accepts the library's facets, so widening this list back is a one-line
 * change if a real need appears.)
 */
export const LIBRARY_FACETS = [
  "query",
  "following",
  "behind",
  "status",
  "rating",
  "runtime",
] as const satisfies readonly (keyof Filters)[];

export const FEED_FACETS = [
  "includeWatched",
] as const satisfies readonly (keyof Filters)[];

/** Movies: seen is the membership, so search, rating and length is all. */
export const MOVIE_FACETS = [
  "query",
  "rating",
  "runtime",
] as const satisfies readonly (keyof Filters)[];

/** Drops whatever the target surface has no notion of. */
export function restrict(
  filters: Filters,
  facets: readonly (keyof Filters)[]
): Filters {
  const out = { ...NO_FILTERS };
  for (const facet of facets) {
    // Each key writes its own type; the union of them is not narrowable
    // per-key without a switch that would say nothing extra.
    (out as Record<string, unknown>)[facet] = filters[facet];
  }
  return out;
}

/** How many facets are actually narrowing anything — for the badges. */
export function activeCount(filters: Filters): number {
  return (
    (filters.query ? 1 : 0) +
    (filters.following !== null ? 1 : 0) +
    (filters.behind !== null ? 1 : 0) +
    (filters.status ? 1 : 0) +
    (filters.rating ? 1 : 0) +
    (filters.runtime ? 1 : 0) +
    (filters.includeWatched ? 1 : 0)
  );
}
