import { Suspense } from "react";
import {
  Container,
  Flex,
  Grid,
  Heading,
  VisuallyHidden,
} from "@radix-ui/themes";
import { createClient } from "@/lib/supabase/server";
import { FadeIn } from "@/components/FadeIn";
import { Stat } from "@/components/Stat";
import { LibraryTabs } from "@/components/library/LibraryTabs";
import { ShowsList } from "@/components/library/ShowsList";
import { MoviesList } from "@/components/library/MoviesList";
import { InvitesCard } from "@/components/invites/InvitesCard";
import { DelayedSpinner } from "@/components/DelayedSpinner";
import { formatRuntime } from "@/lib/format";

/**
 * Everything being tracked, split into Shows and Movies.
 *
 * The tabs are links rather than client-side panels, so only the active one
 * is queried and rendered — with 10ms of CPU per request there is no room to
 * build both and hide one.
 *
 * There is no visible "Home" heading: it would only repeat the nav item
 * directly above it. The totals serve as the page's opening instead, which is
 * at least about the person reading it.
 */
export default async function HomePage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string }>;
}) {
  const { tab } = await searchParams;
  const movies = tab === "movies";

  const supabase = await createClient();

  // The shows count matches the list's membership rule: followed or with
  // watched episodes (series_progress carries exactly those rows).
  const [{ data: totals }, { count: showCount }] = await Promise.all([
    supabase.from("watch_totals").select("*").maybeSingle(),
    supabase
      .from("series_progress")
      .select("*", { count: "exact", head: true }),
  ]);
  const movieCount = totals?.movies_seen ?? 0;

  const hasHistory = (showCount ?? 0) > 0 || movieCount > 0;

  return (
    <Container size="3" px="4">
      <FadeIn>
      <Flex direction="column" gap="5">
        <VisuallyHidden>
          <Heading as="h1">Home</Heading>
        </VisuallyHidden>

        {/* The counts live in the tabs; the stats row keeps what the tabs
            cannot say — time. Six columns so the cells keep the same rhythm
            they had when the count stats sat beside them. */}
        {hasHistory && (
          <Grid columns={{ initial: "3", sm: "6" }} gapX="4" gapY="4">
            <Stat label="Show time" value={formatRuntime(totals?.episode_minutes ?? 0)} />
            <Stat label="Movie time" value={formatRuntime(totals?.movie_minutes ?? 0)} />
            <Stat label="Total time" value={formatRuntime(totals?.minutes_watched ?? 0)} />
          </Grid>
        )}

        <LibraryTabs
          movies={movies}
          showCount={showCount ?? 0}
          movieCount={movieCount}
        />

        {/* Deliberately NOT keyed on the tab: a stable boundary keeps the
            current list on screen through the switch transition — the tabs
            component shows the pending spinner — and the fallback only
            appears while the page streams in on first load. */}
        <Suspense fallback={<DelayedSpinner />}>
          {movies ? <MoviesList /> : <ShowsList />}
        </Suspense>

        <InvitesCard />
      </Flex>
      </FadeIn>
    </Container>
  );
}
