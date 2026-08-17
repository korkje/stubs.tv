"use client";

import { useCallback } from "react";
import Link from "next/link";
import { Badge, Button, Card, Flex, Spinner, Text } from "@radix-ui/themes";
import { FollowStar } from "@/components/tracking/FollowStar";
import { setFollowing } from "@/lib/tracking/actions";
import { fetchLibraryShows, type LibraryShow } from "@/lib/library/actions";
import { serializeFilters, type Filters, type Sort } from "@/lib/filters";
import { AnimatedRows } from "./AnimatedRows";
import { LibraryRow } from "./LibraryRow";
import { useLibraryCounts } from "./LibraryCounts";
import { useLibraryPages } from "./useLibraryPages";

/**
 * The client half of the shows list: holds the accumulated pages, pages
 * more in as the sentinel nears, and owns each row's followed state — the
 * server prop stopped being the truth the moment the rows moved into
 * client state, the same reasoning as the feed's SeenToggle.
 *
 * Unfollowing a show with no watched episodes still drops it from the list
 * — membership requires a follow or watched episodes — but the drop now
 * happens here, after the action lands, instead of through a route
 * re-render. The action revalidates the feed ("/app"), never this route:
 * a self-revalidation would re-render the seed page under pages the server
 * no longer knows about.
 */
export function ShowsListClient({
  seed,
  filters,
  sort,
}: {
  seed: LibraryShow[];
  filters: Filters;
  sort: Sort;
}) {
  const seedKey = serializeFilters(filters, sort).toString();

  const fetchPage = useCallback(
    (offset: number, limit: number) => fetchLibraryShows(filters, sort, offset, limit),
    [filters, sort]
  );

  const { rows, pagedIds, loading, sentinelRef, updateRow, removeRow } =
    useLibraryPages({
      seed,
      seedKey,
      rowId: (show: LibraryShow) =>
        show.series_id != null ? String(show.series_id) : null,
      fetchPage,
    });
  const { adjustShows } = useLibraryCounts();

  const toggleFollow = (show: LibraryShow) => async (next: boolean) => {
    if (show.series_id == null) return;
    const id = String(show.series_id);
    updateRow(id, (row) => ({ ...row, followed: next }));
    try {
      // "/app": following decides what the feed contains.
      await setFollowing(show.series_id, next, "/app");
    } catch {
      updateRow(id, (row) => ({ ...row, followed: !next }));
      return;
    }
    if ((show.watched_episodes ?? 0) === 0) {
      // A show with no watches is a member only through its follow, so the
      // confirmed action IS the membership change. Counting the action
      // rather than the removal keeps a rapid off-and-on at net zero.
      adjustShows(next ? 1 : -1);
      // Removal waits for the server so a failed unfollow never collapses
      // the row — the star snapping back is the whole error UI, matching
      // the toggles everywhere else. The predicate re-checks the row: a
      // re-follow clicked while this round trip ran keeps it.
      if (!next) removeRow(id, (row) => !(row.followed ?? false));
    }
  };

  const empty = rows.length === 0;
  const items = empty
    ? // The empty state is a pseudo-row in the same list as the shows, but
      // crossing between it and results remounts the list (see remountOn
      // below): diffing against a message is churn, not continuity.
      [
        {
          id: "empty",
          node: <EmptyState filtered={serializeFilters(filters).size > 0} />,
        },
      ]
    : rows.map((show) => {
        const aired = show.aired_episodes ?? 0;
        const unseen = show.unwatched_episodes ?? 0;

        return {
          id: `show-${show.series_id}`,
          entrance: !pagedIds.has(String(show.series_id)),
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
                    onToggle={toggleFollow(show)}
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
          overlapping lists worth diffing. Emptiness rides along for the
          same reason — results and the empty-state card are disjoint, so
          narrowing to nothing (or back out of it) swaps cleanly instead of
          collapsing rows around an expanding message. */}
      <AnimatedRows
        key={`shows:${sort.key}:${sort.ascending}`}
        remountOn={[filters.status, filters.following, filters.behind, empty]}
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
