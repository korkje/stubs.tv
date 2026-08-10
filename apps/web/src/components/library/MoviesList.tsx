import Link from "next/link";
import { Badge, Button, Card, Flex, Text } from "@radix-ui/themes";
import { createClient } from "@/lib/supabase/server";
import { Poster } from "@/components/Poster";
import { formatDate, formatRuntime } from "@/lib/format";

/** Everything marked as seen, most recent first. */
export async function MoviesList() {
  const supabase = await createClient();

  // Watches are polymorphic (episode or movie) so there is no foreign key to
  // join on — fetch the watch rows, then the movies they point at.
  const { data: watches } = await supabase
    .from("watches")
    .select("entity_id, watched_at")
    .eq("entity_type", "movie")
    .order("watched_at", { ascending: false, nullsFirst: false });

  const movieIds = (watches ?? []).map((watch) => watch.entity_id);

  if (movieIds.length === 0) {
    return (
      <Card>
        <Flex direction="column" align="start" gap="3" p="2">
          <Text color="gray">
            No movies marked as seen yet. Everything you mark shows up here.
          </Text>
          <Button asChild>
            <Link href="/app/search">Search movies</Link>
          </Button>
        </Flex>
      </Card>
    );
  }

  const [{ data: movies }, { data: ratings }] = await Promise.all([
    supabase.from("movies").select("*").in("id", movieIds),
    supabase
      .from("ratings")
      .select("entity_id, score")
      .eq("entity_type", "movie")
      .in("entity_id", movieIds),
  ]);

  const byId = new Map((movies ?? []).map((movie) => [movie.id, movie]));
  const scoreById = new Map((ratings ?? []).map((r) => [r.entity_id, r.score]));
  const totalRuntime = (movies ?? []).reduce((sum, m) => sum + (m.runtime_min ?? 0), 0);

  return (
    <Flex direction="column" gap="3">
      <Text size="2" color="gray">
        {movieIds.length} seen · {formatRuntime(totalRuntime)} watched
      </Text>

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
  );
}
