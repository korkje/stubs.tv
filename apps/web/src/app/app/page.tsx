import Link from "next/link";
import { Container, Flex, Heading, TabNav } from "@radix-ui/themes";
import { ShowsList } from "@/components/library/ShowsList";
import { MoviesList } from "@/components/library/MoviesList";

/**
 * Everything being tracked, split into Shows and Movies.
 *
 * The tabs are links rather than client-side panels, so only the active one
 * is queried and rendered — with 10ms of CPU per request there is no room to
 * build both and hide one.
 */
export default async function HomePage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string }>;
}) {
  const { tab } = await searchParams;
  const movies = tab === "movies";

  return (
    <Container size="4" px="4">
      <Flex direction="column" gap="4">
        <Heading size="6">Home</Heading>

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
