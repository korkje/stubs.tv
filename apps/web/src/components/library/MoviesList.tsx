import Link from "next/link";
import { Button, Card, Flex, Text } from "@radix-ui/themes";
import { createClient } from "@/lib/supabase/server";
import {
  MOVIE_RUNTIME,
  escapeLike,
  ratingBounds,
  runtimeBounds,
  serializeFilters,
  type Filters,
  type Sort,
} from "@/lib/filters";
import { AnimatedRows } from "./AnimatedRows";
import { LibraryRow } from "./LibraryRow";
import { SeenEye } from "@/components/tracking/SeenEye";

/**
 * Every movie marked as seen. Filtering and sorting are pushed into the
 * query against the movies_seen view — the view exists because rating
 * lives in another table, and "sort by my rating" cannot be expressed
 * across two PostgREST requests without merging in the worker, which the
 * 10ms CPU ceiling rules out.
 */
export async function MoviesList({
  filters,
  sort,
}: {
  filters: Filters;
  sort: Sort;
}) {
  const supabase = await createClient();

  // movies_seen is a security_invoker view, so this returns only the
  // signed-in user's movies.
  let query = supabase.from("movies_seen").select("*");

  if (filters.query) {
    query = query.ilike("name", `%${escapeLike(filters.query)}%`);
  }

  const rating = ratingBounds(filters.rating);
  if (rating.min !== null) query = query.gte("rating", rating.min);
  if (rating.max !== null) query = query.lte("rating", rating.max);

  const runtime = runtimeBounds(filters.runtime, MOVIE_RUNTIME.max);
  if (runtime.min !== null) query = query.gte("runtime_min", runtime.min);
  if (runtime.max !== null) query = query.lte("runtime_min", runtime.max);

  // nullsFirst: false on every key. Postgres sorts DESC with NULLS FIRST, so
  // without it "highest rated" would open with every unrated movie.
  query = query.order(sort.key, { ascending: sort.ascending, nullsFirst: false });
  // Ties always break on name, implicitly — the same rule as the shows.
  if (sort.key !== "name") {
    query = query.order("name", { ascending: true, nullsFirst: false });
  }

  const { data: movies, error } = await query;
  // Same rule as the shows: a swallowed error renders as the empty state,
  // and "nothing matches" must never be how a failure looks.
  if (error) throw new Error(`Could not load the movies: ${error.message}`);

  const empty = !movies || movies.length === 0;
  const rows = empty
      ? // The empty state is a pseudo-row in the same list as the movies, but
        // crossing between it and results remounts the list (see remountOn
        // below): diffing against a message is churn, not continuity.
        [
          {
            id: "empty",
            node: <EmptyState filtered={serializeFilters(filters).size > 0} />,
          },
        ]
      : movies.map((movie) => ({
          id: `movie-${movie.movie_id}`,
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
                  // Unseeing here drops the movie from the list on the next
                  // render — membership is "marked as seen".
                  <SeenEye movieId={movie.movie_id} seen revalidate="/app/library" />
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
        rows={rows}
      />
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
