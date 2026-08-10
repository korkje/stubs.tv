import Link from "next/link";
import { Badge, Button, Card, Container, Flex, Heading, Text } from "@radix-ui/themes";
import { createClient } from "@/lib/supabase/server";
import { Poster } from "@/components/Poster";
import { formatDate, formatRuntime } from "@/lib/format";

export default async function FilmsPage() {
  const supabase = await createClient();

  // Watches are polymorphic (episode or film) so there is no foreign key to
  // join on — fetch the watch rows, then the films they point at.
  const { data: watches } = await supabase
    .from("watches")
    .select("entity_id, watched_at")
    .eq("entity_type", "movie")
    .order("watched_at", { ascending: false, nullsFirst: false });

  const movieIds = (watches ?? []).map((watch) => watch.entity_id);

  const [{ data: movies }, { data: ratings }] = await Promise.all([
    movieIds.length
      ? supabase.from("movies").select("*").in("id", movieIds)
      : Promise.resolve({ data: [] as never[] }),
    movieIds.length
      ? supabase
          .from("ratings")
          .select("entity_id, score")
          .eq("entity_type", "movie")
          .in("entity_id", movieIds)
      : Promise.resolve({ data: [] as never[] }),
  ]);

  const byId = new Map((movies ?? []).map((movie) => [movie.id, movie]));
  const scoreById = new Map((ratings ?? []).map((r) => [r.entity_id, r.score]));
  const totalRuntime = (movies ?? []).reduce((sum, m) => sum + (m.runtime_min ?? 0), 0);

  if (movieIds.length === 0) {
    return (
      <Container size="4" px="4">
        <Flex direction="column" gap="4">
          <Heading size="6">Films</Heading>
          <Card>
            <Flex direction="column" align="start" gap="3" p="2">
              <Text color="gray">
                No films marked as seen yet. Everything you mark shows up here.
              </Text>
              <Button asChild>
                <Link href="/app/search">Search films</Link>
              </Button>
            </Flex>
          </Card>
        </Flex>
      </Container>
    );
  }

  return (
    <Container size="4" px="4">
      <Flex direction="column" gap="4">
        <Flex align="baseline" gap="3" wrap="wrap">
          <Heading size="6">Films</Heading>
          <Text size="2" color="gray">
            {movieIds.length} seen · {formatRuntime(totalRuntime)} watched
          </Text>
        </Flex>

        <Flex direction="column" gap="3">
          {(watches ?? []).map((watch) => {
            const movie = byId.get(watch.entity_id);
            if (!movie) return null;
            const score = scoreById.get(movie.id);

            return (
              <Card key={movie.id} asChild>
                <Link href={`/app/movies/${movie.id}`}>
                  <Flex gap="4" align="center">
                    <Poster url={movie.poster_url} alt={movie.name} width={56} />
                    <Flex direction="column" gap="1">
                      <Flex align="center" gap="2" wrap="wrap">
                        <Text weight="bold" size="3">
                          {movie.name}
                        </Text>
                        {movie.released && (
                          <Text size="2" color="gray">
                            {movie.released.slice(0, 4)}
                          </Text>
                        )}
                        {score && (
                          <Badge color="amber" variant="soft">
                            {score} / 10
                          </Badge>
                        )}
                      </Flex>
                      <Text size="2" color="gray">
                        {watch.watched_at
                          ? `Seen ${formatDate(watch.watched_at.slice(0, 10))}`
                          : "Seen — date unknown"}
                      </Text>
                    </Flex>
                  </Flex>
                </Link>
              </Card>
            );
          })}
        </Flex>
      </Flex>
    </Container>
  );
}
