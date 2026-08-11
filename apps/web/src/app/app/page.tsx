import Link from "next/link";
import {
  Container,
  Flex,
  Grid,
  Heading,
  Separator,
  TabNav,
  VisuallyHidden,
} from "@radix-ui/themes";
import { createClient } from "@/lib/supabase/server";
import { Stat } from "@/components/Stat";
import { ShowsList } from "@/components/library/ShowsList";
import { MoviesList } from "@/components/library/MoviesList";
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

  const [{ data: totals }, { count: showsFollowed }] = await Promise.all([
    supabase.from("watch_totals").select("*").maybeSingle(),
    supabase
      .from("follows")
      .select("*", { count: "exact", head: true })
      .eq("entity_type", "series"),
  ]);

  const hasHistory =
    (totals?.episodes_seen ?? 0) > 0 ||
    (totals?.movies_seen ?? 0) > 0 ||
    (showsFollowed ?? 0) > 0;

  return (
    <Container size="4" px="4">
      <Flex direction="column" gap="5">
        <VisuallyHidden>
          <Heading as="h1">Home</Heading>
        </VisuallyHidden>

        {hasHistory && (
          <>
            {/* Six stats rather than four: three per row on a phone reads far
                better than a row of three and an orphan. */}
            <Grid columns={{ initial: "3", sm: "6" }} gapX="4" gapY="4">
              <Stat label="Shows followed" value={String(showsFollowed ?? 0)} />
              <Stat label="Episodes seen" value={String(totals?.episodes_seen ?? 0)} />
              <Stat label="Movies seen" value={String(totals?.movies_seen ?? 0)} />
              <Stat label="Show time" value={formatRuntime(totals?.episode_minutes ?? 0)} />
              <Stat label="Movie time" value={formatRuntime(totals?.movie_minutes ?? 0)} />
              <Stat label="Total time" value={formatRuntime(totals?.minutes_watched ?? 0)} />
            </Grid>
            <Separator size="4" />
          </>
        )}

        <TabNav.Root>
          <TabNav.Link asChild active={!movies}>
            <Link href="/app">Shows</Link>
          </TabNav.Link>
          <TabNav.Link asChild active={movies}>
            <Link href="/app?tab=movies">Movies</Link>
          </TabNav.Link>
        </TabNav.Root>

        {movies ? <MoviesList /> : <ShowsList />}
      </Flex>
    </Container>
  );
}
