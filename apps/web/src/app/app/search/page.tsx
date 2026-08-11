import Link from "next/link";
import {
  Badge,
  Box,
  Button,
  Callout,
  Card,
  Container,
  Flex,
  Heading,
  Text,
  VisuallyHidden,
} from "@radix-ui/themes";
import { SearchField } from "@/components/SearchField";
import { createClient } from "@/lib/supabase/server";
import { getMetadataProvider } from "@/lib/metadata/provider";
import { resolveSearchResults, titlePath } from "@/lib/metadata/ingest";
import { Poster } from "@/components/Poster";
import { FollowStar } from "@/components/tracking/FollowStar";
import { SeenEye } from "@/components/tracking/SeenEye";

export default async function SearchPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const { q } = await searchParams;
  const query = q?.trim() ?? "";

  return (
    <Container size="4" px="4">
      <Flex direction="column" gap="5">
        {/* No visible heading: it would only repeat the nav item above it,
            and the field makes the purpose obvious. */}
        <VisuallyHidden>
          <Heading as="h1">Search</Heading>
        </VisuallyHidden>

        <form>
          <Flex gap="3" align="center">
            <Box flexGrow="1" style={{ minWidth: 0 }}>
              <SearchField defaultValue={query} />
            </Box>
            <Button size="3" type="submit">
              Search
            </Button>
          </Flex>
        </form>

        {query ? (
          <Results query={query} />
        ) : (
          <Text size="2" color="gray">
            Everything on TheTVDB is here — series, one-off specials and
            movies. Find something to follow, or to add to what you have
            already watched.
          </Text>
        )}
      </Flex>
    </Container>
  );
}

async function Results({ query }: { query: string }) {
  let results;
  try {
    results = await getMetadataProvider().search(query, { limit: 24 });
  } catch {
    return (
      <Callout.Root color="red">
        <Callout.Text>
          Could not reach the metadata service. Please try again in a moment.
        </Callout.Text>
      </Callout.Root>
    );
  }

  if (results.length === 0) {
    return <Text color="gray">No movies or TV shows match “{query}”.</Text>;
  }

  // Give every hit an internal ID so links never expose provider IDs.
  const ids = await resolveSearchResults(results);

  // The user's existing state for these hits, so each row can carry its
  // toggle: follow star for series, seen eye for films. RLS scopes both
  // queries to the signed-in user.
  const seriesIds = results
    .filter((r) => r.kind === "series")
    .map((r) => ids.get(`series:${r.providerId}`))
    .filter((id): id is number => id != null);
  const movieIds = results
    .filter((r) => r.kind === "movie")
    .map((r) => ids.get(`movie:${r.providerId}`))
    .filter((id): id is number => id != null);

  const supabase = await createClient();
  const [{ data: follows }, { data: movieWatches }] = await Promise.all([
    seriesIds.length
      ? supabase
          .from("follows")
          .select("entity_id")
          .eq("entity_type", "series")
          .in("entity_id", seriesIds)
      : { data: [] },
    movieIds.length
      ? supabase
          .from("watches")
          .select("entity_id")
          .eq("entity_type", "movie")
          .in("entity_id", movieIds)
      : { data: [] },
  ]);
  const followedSeries = new Set((follows ?? []).map((f) => f.entity_id));
  const seenMovies = new Set((movieWatches ?? []).map((w) => w.entity_id));

  return (
    <Flex direction="column" gap="3">
      {results.map((result) => {
        const internalId = ids.get(`${result.kind}:${result.providerId}`);
        if (!internalId) return null;

        return (
          <Card key={`${result.kind}-${result.providerId}`} asChild>
            <Link href={titlePath(result.kind, internalId)}>
              <Flex gap="4" align="start">
                <Poster url={result.posterUrl} alt={result.name} width={64} />
                <Flex direction="column" gap="1" pt="1" flexGrow="1" style={{ minWidth: 0 }}>
                  <Flex justify="between" align="start" gap="2">
                    <Flex align="center" gap="2" wrap="wrap">
                      <Text weight="bold" size="3">
                        {result.name}
                      </Text>
                      {result.year && (
                        <Text size="2" color="gray">
                          {result.year}
                        </Text>
                      )}
                      <Badge color={result.kind === "series" ? "amber" : "blue"} variant="soft">
                        {result.kind === "series" ? "TV" : "Movie"}
                      </Badge>
                    </Flex>
                    {/* Match the title's line height so the toggle centers on
                        the first line even when the title wraps. */}
                    <Flex
                      align="center"
                      flexShrink="0"
                      style={{ height: "var(--line-height-3)" }}
                    >
                      {result.kind === "series" ? (
                        <FollowStar
                          seriesId={internalId}
                          following={followedSeries.has(internalId)}
                          revalidate="/app/search"
                        />
                      ) : (
                        <SeenEye
                          movieId={internalId}
                          seen={seenMovies.has(internalId)}
                          revalidate="/app/search"
                        />
                      )}
                    </Flex>
                  </Flex>
                  {result.overview && (
                    <Text as="div" size="2" color="gray" className="clamp-summary">
                      {result.overview}
                    </Text>
                  )}
                </Flex>
              </Flex>
            </Link>
          </Card>
        );
      })}
    </Flex>
  );
}
