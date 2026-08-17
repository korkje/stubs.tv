"use server";

import type { Database } from "@stubs/db";
import { createClient } from "@/lib/supabase/server";
import {
  DEFAULT_SORT,
  LIBRARY_FACETS,
  MOVIE_FACETS,
  MOVIE_RUNTIME,
  MOVIE_SORT_KEYS,
  SHOW_RUNTIME,
  SHOW_SORT_KEYS,
  escapeLike,
  ratingBounds,
  restrict,
  runtimeBounds,
  type Filters,
  type Sort,
  type SortKeyDef,
} from "@/lib/filters";

export type LibraryShow = Database["public"]["Views"]["series_progress"]["Row"];
export type LibraryMovie = Database["public"]["Views"]["movies_seen"]["Row"];

/**
 * Actions are a public endpoint, so the inputs are re-validated here even
 * though the page already parsed them once: the sort key is checked against
 * the surface's own list (never spliced into the order clause raw), the
 * filters are re-restricted to the surface's facets, and the offset is
 * clamped to a sane window. RLS handles the data itself — a forged call
 * still only ever sees the caller's own rows.
 */
function checkSort(sort: Sort, keys: readonly SortKeyDef[]): Sort {
  if (!keys.some((k) => k.value === sort.key)) return DEFAULT_SORT;
  return { key: sort.key, ascending: sort.ascending === true };
}

function checkOffset(offset: number): number {
  if (!Number.isFinite(offset)) return 0;
  return Math.min(Math.max(Math.trunc(offset), 0), 100_000);
}

function checkLimit(limit: number): number {
  if (!Number.isFinite(limit)) return 1;
  return Math.min(Math.max(Math.trunc(limit), 1), 50);
}

/**
 * One page of the shows list: every show the user follows or has watched
 * episodes of, filtered and sorted in the query — the 10ms CPU ceiling
 * leaves no room to fetch a library and narrow it in the worker. The
 * library page calls this directly for the seed page; the client list
 * calls it as a server action for every page after that.
 *
 * Offset pagination rather than keyset: the sort key is user-chosen and
 * mostly nullable, which makes a correct keyset cursor a different shape
 * per key, and a personal library is thousands of rows at most — offset
 * cost is noise at that size. Known trade-off: a row added or removed
 * between pages can shift a boundary by one; the client dedupes the
 * overlap direction and the gap direction heals on the next visit.
 */
export async function fetchLibraryShows(
  filters: Filters,
  sort: Sort,
  offset: number,
  limit: number
): Promise<LibraryShow[]> {
  const supabase = await createClient();
  const safeFilters = restrict(filters, LIBRARY_FACETS);
  const safeSort = checkSort(sort, SHOW_SORT_KEYS);
  const from = checkOffset(offset);
  const size = checkLimit(limit);

  // series_progress is a security_invoker view, so this returns only the
  // signed-in user's shows.
  let query = supabase.from("series_progress").select("*");

  if (safeFilters.query) {
    query = query.ilike("name", `%${escapeLike(safeFilters.query)}%`);
  }
  // Tri-states: null asks nothing, false is a real question ("not
  // followed", "caught up"), not the absence of one.
  if (safeFilters.following !== null)
    query = query.eq("followed", safeFilters.following);
  if (safeFilters.behind !== null) {
    query = safeFilters.behind
      ? query.gt("unwatched_episodes", 0)
      : query.eq("unwatched_episodes", 0);
  }
  if (safeFilters.status) query = query.eq("status", safeFilters.status);

  const rating = ratingBounds(safeFilters.rating);
  if (rating.min !== null) query = query.gte("rating", rating.min);
  if (rating.max !== null) query = query.lte("rating", rating.max);

  const runtime = runtimeBounds(safeFilters.runtime, SHOW_RUNTIME.max);
  if (runtime.min !== null) query = query.gte("runtime_min", runtime.min);
  if (runtime.max !== null) query = query.lte("runtime_min", runtime.max);

  // nullsFirst: false on every key. Postgres sorts DESC with NULLS FIRST, so
  // without it "highest rated" would open with every unrated show.
  query = query.order(safeSort.key, {
    ascending: safeSort.ascending,
    nullsFirst: false,
  });
  // Ties always break on name, implicitly — the one tiebreaker anyone
  // actually asks for, so it is a rule rather than a control. With
  // pagination it is also load-bearing: an unstable order across two
  // range() calls would duplicate and drop rows at every page boundary.
  if (safeSort.key !== "name") {
    query = query.order("name", { ascending: true, nullsFirst: false });
  }

  const { data, error } = await query.range(from, from + size - 1);
  // Swallowing this made a failed query render as "No shows match these
  // filters" — indistinguishable from zero matches (an unapplied migration
  // wore that disguise for a whole debugging session).
  if (error) throw new Error(`Could not load the shows: ${error.message}`);
  return data ?? [];
}

/**
 * One page of the movies list: every movie marked as seen. Same shape and
 * same rules as the shows — the movies_seen view exists because rating
 * lives in another table, and "sort by my rating" cannot be expressed
 * across two PostgREST requests without merging in the worker.
 */
export async function fetchLibraryMovies(
  filters: Filters,
  sort: Sort,
  offset: number,
  limit: number
): Promise<LibraryMovie[]> {
  const supabase = await createClient();
  const safeFilters = restrict(filters, MOVIE_FACETS);
  const safeSort = checkSort(sort, MOVIE_SORT_KEYS);
  const from = checkOffset(offset);
  const size = checkLimit(limit);

  // movies_seen is a security_invoker view, so this returns only the
  // signed-in user's movies.
  let query = supabase.from("movies_seen").select("*");

  if (safeFilters.query) {
    query = query.ilike("name", `%${escapeLike(safeFilters.query)}%`);
  }

  const rating = ratingBounds(safeFilters.rating);
  if (rating.min !== null) query = query.gte("rating", rating.min);
  if (rating.max !== null) query = query.lte("rating", rating.max);

  const runtime = runtimeBounds(safeFilters.runtime, MOVIE_RUNTIME.max);
  if (runtime.min !== null) query = query.gte("runtime_min", runtime.min);
  if (runtime.max !== null) query = query.lte("runtime_min", runtime.max);

  query = query.order(safeSort.key, {
    ascending: safeSort.ascending,
    nullsFirst: false,
  });
  if (safeSort.key !== "name") {
    query = query.order("name", { ascending: true, nullsFirst: false });
  }

  const { data, error } = await query.range(from, from + size - 1);
  if (error) throw new Error(`Could not load the movies: ${error.message}`);
  return data ?? [];
}
