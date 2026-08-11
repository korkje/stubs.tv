import Link from "next/link";
import { Button, Card, Flex, Text } from "@radix-ui/themes";
import { createClient } from "@/lib/supabase/server";
import { LibraryRow } from "./LibraryRow";

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

  return (
    <Flex direction="column" gap="3">
      {(watches ?? []).map((watch) => {
        const movie = byId.get(watch.entity_id);
        if (!movie) return null;

        return (
          <LibraryRow
            key={movie.id}
            href={`/app/movies/${movie.id}`}
            name={movie.name}
            posterUrl={movie.poster_url}
            date={movie.released}
            runtimeMin={movie.runtime_min}
            rating={scoreById.get(movie.id) ?? null}
            overview={movie.overview}
          />
        );
      })}
    </Flex>
  );
}
