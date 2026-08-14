import {
  Badge,
  Callout,
  Container,
  Flex,
  Heading,
  Text,
  VisuallyHidden,
} from "@radix-ui/themes";
import { Suspense } from "react";
import { DelayedSpinner } from "@/components/DelayedSpinner";
import { FadeIn } from "@/components/FadeIn";
import { SearchForm } from "@/components/SearchForm";
import { createClient } from "@/lib/supabase/server";
import { getMetadataProvider } from "@/lib/metadata/provider";
import { resolveSearchResults, searchScores, titlePath } from "@/lib/metadata/ingest";
import { AnimatedRows } from "@/components/library/AnimatedRows";
import { LibraryRow } from "@/components/library/LibraryRow";
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
    <Container size="3" px="4">
      <FadeIn>
      <Flex direction="column" gap="5">
        {/* No visible heading: it would only repeat the nav item above it,
            and the field makes the purpose obvious. */}
        <VisuallyHidden>
          <Heading as="h1">Search</Heading>
        </VisuallyHidden>

        <SearchForm defaultValue={query} />

        {query ? (
          /* Deliberately NOT keyed on the query: a stable boundary keeps the
             current results on screen while the next ones render — the
             search button's spinner is the one pending indicator — and the
             fallback only appears when the page streams in on first load. */
          <Suspense fallback={<DelayedSpinner />}>
            <Results query={query} />
          </Suspense>
        ) : (
          <Text size="2" color="gray">
            Everything on TheTVDB is here — series, one-off specials and
            movies. Find something to follow, or to add to what you have
            already watched.
          </Text>
        )}
      </Flex>
      </FadeIn>
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
  const [scores, { data: follows }, { data: movieWatches }] = await Promise.all([
    searchScores(results, ids),
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

  // TVDB's own order is close to random ("Harry Potter" lists fan films
  // before the real ones), so rank by popularity instead. Unscored hits sink
  // to the bottom in provider order.
  const ranked = results
    .map((result, index) => ({
      result,
      index,
      score: scores.get(`${result.kind}:${result.providerId}`) ?? -1,
    }))
    .sort((a, b) => b.score - a.score || a.index - b.index)
    .map((entry) => entry.result);

  // The same row component as the Shows and Movies lists, so search results
  // cannot drift apart from them in shape, spacing or type sizes.
  return (
    <Flex direction="column">
      {/* Keyed on the query so a new result set mounts fresh and staggers
          in, instead of cross-animating against the old rows. */}
      <AnimatedRows
        key={query}
        rows={ranked.flatMap((result) => {
        const internalId = ids.get(`${result.kind}:${result.providerId}`);
        if (!internalId) return [];

        return {
          id: `${result.kind}-${result.providerId}`,
          node: (
          <LibraryRow
            href={titlePath(result.kind, internalId)}
            name={result.name}
            posterUrl={result.posterUrl}
            date={result.year != null ? String(result.year) : null}
            runtimeMin={null}
            rating={null}
            overview={result.overview}
            badge={
              <Badge size="1" color={result.kind === "series" ? "amber" : "blue"} variant="soft">
                {result.kind === "series" ? "TV" : "Movie"}
              </Badge>
            }
            titleIcon={
              result.kind === "series" ? (
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
              )
            }
          />
          ),
        };
      })}
      />
    </Flex>
  );
}
