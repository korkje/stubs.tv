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
import { getMetadataProvider } from "@/lib/metadata/provider";
import { resolveSearchResults, titlePath } from "@/lib/metadata/ingest";
import { Poster } from "@/components/Poster";

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
                <Flex direction="column" gap="1" pt="1">
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
