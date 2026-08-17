"use client";

import { useCallback, useRef, useState } from "react";
import Link from "next/link";
import { Button, Card, Flex, Spinner, Text } from "@radix-ui/themes";
import { SeenEye } from "@/components/tracking/SeenEye";
import { markSeen, unmarkSeen } from "@/lib/tracking/actions";
import { fetchLibraryMovies, type LibraryMovie } from "@/lib/library/actions";
import { serializeFilters, type Filters, type Sort } from "@/lib/filters";
import { AnimatedRows } from "./AnimatedRows";
import { LibraryRow } from "./LibraryRow";
import { useLibraryCounts } from "./LibraryCounts";
import { useLibraryPages } from "./useLibraryPages";

/**
 * The client half of the movies list — same shape as the shows: pages
 * accumulate here, the eye toggle owns its state, and un-seeing drops the
 * row after the server confirms, since membership is "marked as seen".
 *
 * The rows carry no seen column (being in movies_seen IS seen), so the
 * moment between "eye clicked off" and "row removed" needs its own state:
 * `unseen` holds the ids whose eye is off while the round trip runs — and
 * whose row stays, briefly, so a failure can snap the eye back instead of
 * conjuring a vanished row out of nowhere.
 */
export function MoviesListClient({
  seed,
  filters,
  sort,
}: {
  seed: LibraryMovie[];
  filters: Filters;
  sort: Sort;
}) {
  const seedKey = serializeFilters(filters, sort).toString();

  const fetchPage = useCallback(
    (offset: number, limit: number) => fetchLibraryMovies(filters, sort, offset, limit),
    [filters, sort]
  );

  const { rows, pagedIds, loading, sentinelRef, removeRow } = useLibraryPages({
    seed,
    seedKey,
    rowId: (movie: LibraryMovie) =>
      movie.movie_id != null ? String(movie.movie_id) : null,
    fetchPage,
  });

  const [unseen, setUnseen] = useState<ReadonlySet<string>>(new Set());
  // The ref mirrors the state for the check after the await below: the
  // rows carry no seen column (being in movies_seen IS seen), so a re-see
  // clicked mid-round-trip is only visible through the eye state itself.
  const unseenRef = useRef<ReadonlySet<string>>(unseen);
  const setEye = (id: string, seen: boolean) => {
    const next = new Set(unseenRef.current);
    if (seen) next.delete(id);
    else next.add(id);
    unseenRef.current = next;
    setUnseen(next);
  };
  const { adjustMovies } = useLibraryCounts();

  const toggleSeen = (movie: LibraryMovie) => async (next: boolean) => {
    if (movie.movie_id == null) return;
    const id = String(movie.movie_id);
    setEye(id, next);
    try {
      // Movies feed nothing else — no path to revalidate.
      if (next) await markSeen("movie", movie.movie_id);
      else await unmarkSeen("movie", movie.movie_id);
    } catch {
      setEye(id, !next);
      return;
    }
    // Membership is "seen", so the confirmed action is the count change;
    // a rapid unsee-then-resee nets to zero and keeps its row.
    adjustMovies(next ? 1 : -1);
    if (!next && unseenRef.current.has(id)) removeRow(id);
  };

  const empty = rows.length === 0;
  const items = empty
    ? // The empty state is a pseudo-row in the same list as the movies, but
      // crossing between it and results remounts the list (see remountOn
      // below): diffing against a message is churn, not continuity.
      [
        {
          id: "empty",
          node: <EmptyState filtered={serializeFilters(filters).size > 0} />,
        },
      ]
    : rows.map((movie) => ({
        id: `movie-${movie.movie_id}`,
        entrance: !pagedIds.has(String(movie.movie_id)),
        node: (
          <LibraryRow
            href={`/app/movies/${movie.movie_id}`}
            name={movie.name ?? "Untitled"}
            posterUrl={movie.poster_url}
            date={movie.released}
            runtimeMin={movie.runtime_min}
            rating={movie.rating}
            overview={movie.overview}
            titleIcon={
              movie.movie_id != null ? (
                <SeenEye
                  movieId={movie.movie_id}
                  seen={!unseen.has(String(movie.movie_id))}
                  onToggle={toggleSeen(movie)}
                />
              ) : null
            }
          />
        ),
      }));

  return (
    <Flex direction="column">
      {/* Same keying rules as the shows list: the tab in the key stops
          cross-animating between the two lists, the sort in it makes a
          reorder a fresh entrance, and the filters deliberately absent from
          it let a filter change animate the difference. Emptiness remounts
          for the same reason as the shows list: results and the empty-state
          card are disjoint, so there is no difference worth animating. */}
      <AnimatedRows
        key={`movies:${sort.key}:${sort.ascending}`}
        remountOn={[empty]}
        rows={items}
      />
      {loading && (
        <Flex justify="center" py="3">
          <Spinner size="2" />
        </Flex>
      )}
      <div ref={sentinelRef} />
    </Flex>
  );
}

/**
 * "Nothing matches" and "nothing here" are different situations and the
 * way out of each is different: clear the filters — back to this tab, not
 * the default one — or go find a movie.
 */
function EmptyState({ filtered }: { filtered: boolean }) {
  return (
    <Card>
      <Flex direction="column" align="start" gap="3" p="2">
        <Text color="gray">
          {filtered
            ? "No movies match these filters."
            : "No movies marked as seen yet. Everything you mark shows up here."}
        </Text>
        <Button asChild variant={filtered ? "soft" : "solid"}>
          <Link href={filtered ? "/app/library?tab=movies" : "/app/search"}>
            {filtered ? "Clear filters" : "Search movies"}
          </Link>
        </Button>
      </Flex>
    </Card>
  );
}
