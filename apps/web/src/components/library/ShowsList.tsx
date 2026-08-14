import Link from "next/link";
import { Badge, Button, Card, Flex, Text } from "@radix-ui/themes";
import { createClient } from "@/lib/supabase/server";
import { FollowStar } from "@/components/tracking/FollowStar";
import {
  SHOW_RUNTIME,
  escapeLike,
  ratingBounds,
  runtimeBounds,
  serializeFilters,
  type Filters,
  type Sort,
} from "@/lib/filters";
import { AnimatedRows } from "./AnimatedRows";
import { LibraryRow } from "./LibraryRow";

/**
 * Every show the user follows or has watched episodes of, with how much is
 * left to watch. Each row carries the follow star, which doubles as the
 * toggle. Unfollowing a show with no watches drops it from the list on the
 * next render — membership requires a follow or watched episodes.
 *
 * Filtering and sorting are pushed into the query rather than applied to the
 * result: with 10ms of CPU per request there is no room to fetch a library
 * and narrow it here.
 */
export async function ShowsList({
  filters,
  sort,
}: {
  filters: Filters;
  sort: Sort;
}) {
  const supabase = await createClient();

  // series_progress is a security_invoker view, so this returns only the
  // signed-in user's shows.
  let query = supabase.from("series_progress").select("*");

  if (filters.query) {
    query = query.ilike("name", `%${escapeLike(filters.query)}%`);
  }
  // Tri-states: null asks nothing, false is a real question ("not
  // followed", "caught up"), not the absence of one.
  if (filters.following !== null) query = query.eq("followed", filters.following);
  if (filters.behind !== null) {
    query = filters.behind
      ? query.gt("unwatched_episodes", 0)
      : query.eq("unwatched_episodes", 0);
  }
  if (filters.status) query = query.eq("status", filters.status);

  const rating = ratingBounds(filters.rating);
  if (rating.min !== null) query = query.gte("rating", rating.min);
  if (rating.max !== null) query = query.lte("rating", rating.max);

  const runtime = runtimeBounds(filters.runtime, SHOW_RUNTIME.max);
  if (runtime.min !== null) query = query.gte("runtime_min", runtime.min);
  if (runtime.max !== null) query = query.lte("runtime_min", runtime.max);

  // nullsFirst: false on every key. Postgres sorts DESC with NULLS FIRST, so
  // without it "highest rated" would open with every unrated show.
  query = query.order(sort.key, { ascending: sort.ascending, nullsFirst: false });
  // Ties always break on name, implicitly — the one tiebreaker anyone
  // actually asks for, so it is a rule rather than a control.
  if (sort.key !== "name") {
    query = query.order("name", { ascending: true, nullsFirst: false });
  }

  const { data: shows } = await query;

  const rows =
    !shows || shows.length === 0
      ? // The empty state rides the same list as the rows, so narrowing to
        // nothing collapses the last rows while the message expands in,
        // instead of the whole thing being swapped mid-animation.
        [
          {
            id: "empty",
            node: <EmptyState filtered={serializeFilters(filters).size > 0} />,
          },
        ]
      : shows.map((show) => {
          const aired = show.aired_episodes ?? 0;
          const unseen = show.unwatched_episodes ?? 0;

          return {
            id: `show-${show.series_id}`,
            node: (
              <LibraryRow
                href={`/app/series/${show.series_id}`}
                name={show.name ?? "Untitled"}
                posterUrl={show.poster_url}
                date={show.first_aired}
                runtimeMin={show.runtime_min}
                rating={show.rating}
                overview={show.overview}
                titleIcon={
                  show.series_id != null ? (
                    <FollowStar
                      seriesId={show.series_id}
                      following={show.followed ?? false}
                      revalidate="/app/library"
                    />
                  ) : null
                }
                badge={
                  unseen > 0 ? (
                    <Badge size="1" color="amber" variant="soft">
                      {unseen} to watch
                    </Badge>
                  ) : aired > 0 ? (
                    <Badge size="1" color="gray" variant="soft">
                      Up to date
                    </Badge>
                  ) : null
                }
              />
            ),
          };
        });

  return (
    <Flex direction="column">
      {/* Keyed on the tab (so shows never cross-animate into movies) and on
          the sort — a reorder moves every row at once, which reads better
          as a fresh entrance than as rows teleporting through each other's
          clip boxes. Deliberately NOT keyed on the filters: the instance
          surviving a filter change is what lets AnimatedRows animate the
          difference — dropped rows collapse away, survivors keep their
          place, returning rows expand back in. The single-choice facets go
          in remountOn instead: only a change touching "All" produces
          overlapping lists worth diffing. */}
      <AnimatedRows
        key={`shows:${sort.key}:${sort.ascending}`}
        remountOn={[filters.status, filters.following, filters.behind]}
        rows={rows}
      />
    </Flex>
  );
}

/**
 * "Nothing matches" and "nothing here" are different situations and the
 * way out of each is different: clear the filters, or go find a show.
 */
function EmptyState({ filtered }: { filtered: boolean }) {
  return (
    <Card>
      <Flex direction="column" align="start" gap="3" p="2">
        <Text color="gray">
          {filtered
            ? "No shows match these filters."
            : "Nothing here yet. Find a show and follow it or mark episodes as seen, and it will show up here."}
        </Text>
        <Button asChild variant={filtered ? "soft" : "solid"}>
          <Link href={filtered ? "/app/library" : "/app/search"}>
            {filtered ? "Clear filters" : "Search shows"}
          </Link>
        </Button>
      </Flex>
    </Card>
  );
}
