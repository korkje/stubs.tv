import { Suspense } from "react";
import {
  Container,
  Flex,
  Grid,
  Heading,
  VisuallyHidden,
} from "@radix-ui/themes";
import { createClient } from "@/lib/supabase/server";
import {
  LIBRARY_FACETS,
  MOVIE_FACETS,
  MOVIE_RUNTIME,
  MOVIE_SORT_KEYS,
  SHOW_RUNTIME,
  SHOW_SORT_KEYS,
  parseFilters,
  parseSort,
  restrict,
} from "@/lib/filters";
import { FadeIn } from "@/components/FadeIn";
import { LibraryToolbar } from "@/components/filters/LibraryToolbar";
import { TimeStat } from "@/components/TimeStat";
import { LibraryTabs } from "@/components/library/LibraryTabs";
import { ShowsList } from "@/components/library/ShowsList";
import { MoviesList } from "@/components/library/MoviesList";
import { DelayedSpinner } from "@/components/DelayedSpinner";

/**
 * Everything being tracked, split into Shows and Movies.
 *
 * The tabs are links rather than client-side panels, so only the active one
 * is queried and rendered — with 10ms of CPU per request there is no room to
 * build both and hide one.
 *
 * There is no visible "Library" heading: it would only repeat the nav item
 * directly above it. The totals serve as the page's opening instead, which is
 * at least about the person reading it.
 */
export default async function LibraryPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const movies = params.tab === "movies";
  // Each tab restricts to its own facets and validates against its own
  // sort keys: a shows URL opened on the movies tab must not leave phantom
  // chips for facets the tab has no controls to clear, nor ask the view to
  // order by a column it does not have.
  const filters = restrict(parseFilters(params), movies ? MOVIE_FACETS : LIBRARY_FACETS);
  const sort = parseSort(params, movies ? MOVIE_SORT_KEYS : SHOW_SORT_KEYS);

  const supabase = await createClient();

  // The shows count matches the list's membership rule: followed or with
  // watched episodes (series_progress carries exactly those rows).
  const [totalsResult, showCountResult] = await Promise.all([
    supabase.from("watch_totals").select("*").maybeSingle(),
    supabase
      .from("series_progress")
      .select("*", { count: "exact", head: true }),
  ]);
  // Unchecked, a failure here renders as "no history" — the same lie in a
  // different place as an unchecked list query rendering as "no matches".
  if (totalsResult.error)
    throw new Error(`Could not load the watch totals: ${totalsResult.error.message}`);
  if (showCountResult.error)
    throw new Error(`Could not count the shows: ${showCountResult.error.message}`);
  const totals = totalsResult.data;
  const showCount = showCountResult.count;
  const movieCount = totals?.movies_seen ?? 0;

  const hasHistory = (showCount ?? 0) > 0 || movieCount > 0;

  return (
    <Container size="3" px="4">
      <FadeIn>
      <Flex direction="column" gap="5">
        <VisuallyHidden>
          <Heading as="h1">Library</Heading>
        </VisuallyHidden>

        {/* The counts live in the tabs; the stats row keeps what the tabs
            cannot say — time. Six columns so the cells keep the same rhythm
            they had when the count stats sat beside them. */}
        {hasHistory && (
          <Grid columns={{ initial: "3", sm: "6" }} gapX="4" gapY="4">
            <TimeStat label="Show time" minutes={totals?.episode_minutes ?? 0} />
            <TimeStat label="Movie time" minutes={totals?.movie_minutes ?? 0} />
            <TimeStat label="Total time" minutes={totals?.minutes_watched ?? 0} />
          </Grid>
        )}

        <LibraryTabs
          movies={movies}
          showCount={showCount ?? 0}
          movieCount={movieCount}
        />

        {/* Below the tabs, not above them: that scopes the controls to the
            active tab, which is what lets the two tabs offer different
            facets, sort keys and slider scales through the same bar.
            Movies' two-slider facet set opens as a popover (compact);
            the shows' five facets get the inline panel. */}
        {movies ? (
          <LibraryToolbar
            filters={filters}
            sort={sort}
            facets={MOVIE_FACETS}
            sortKeys={MOVIE_SORT_KEYS}
            searchPlaceholder="Search your movies"
            runtime={MOVIE_RUNTIME}
            compact
          />
        ) : (
          <LibraryToolbar
            filters={filters}
            sort={sort}
            facets={LIBRARY_FACETS}
            sortKeys={SHOW_SORT_KEYS}
            searchPlaceholder="Search your shows"
            runtime={SHOW_RUNTIME}
          />
        )}

        {/* Deliberately NOT keyed on the tab: a stable boundary keeps the
            current list on screen through the switch transition — the tabs
            component shows the pending spinner — and the fallback only
            appears while the page streams in on first load. */}
        <Suspense fallback={<DelayedSpinner />}>
          {movies ? (
            <MoviesList filters={filters} sort={sort} />
          ) : (
            <ShowsList filters={filters} sort={sort} />
          )}
        </Suspense>
      </Flex>
      </FadeIn>
    </Container>
  );
}
