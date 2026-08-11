import { notFound } from "next/navigation";
import { Badge, Box, Container, Flex, Heading, Text } from "@radix-ui/themes";
import { ensureMovieIngested } from "@/lib/metadata/ingest";
import { createClient } from "@/lib/supabase/server";
import { Backdrop } from "@/components/Backdrop";
import { Poster } from "@/components/Poster";
import { RatingSelect } from "@/components/tracking/RatingSelect";
import { SeenToggleButton } from "@/components/tracking/SeenToggleButton";
import { formatDate } from "@/lib/format";

export default async function MoviePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const movieId = Number(id);
  if (!Number.isInteger(movieId)) notFound();

  await ensureMovieIngested(movieId);

  const supabase = await createClient();
  const path = `/app/movies/${movieId}`;

  const [{ data: movie }, { data: watch }, { data: rating }] = await Promise.all([
    supabase.from("movies").select("*").eq("id", movieId).maybeSingle(),
    supabase
      .from("watches")
      .select("id")
      .eq("entity_type", "movie")
      .eq("entity_id", movieId)
      .maybeSingle(),
    supabase
      .from("ratings")
      .select("score")
      .eq("entity_type", "movie")
      .eq("entity_id", movieId)
      .maybeSingle(),
  ]);

  if (!movie) notFound();

  return (
    <>
      {movie.backdrop_url && <Backdrop url={movie.backdrop_url} alt={movie.name} />}
      <Container size="3" px="4">
        <Flex gap="5" align="start" wrap="wrap" position="relative">
          <Box display={movie.backdrop_url ? { initial: "none", sm: "block" } : undefined}>
            <Poster url={movie.poster_url} alt={movie.name} width={160} />
          </Box>
        <Flex direction="column" gap="3" style={{ flex: "1 1 320px" }}>
          <Box>
            <Heading size="7">{movie.name}</Heading>
            <Flex align="center" gap="2" mt="1" wrap="wrap">
              <Text size="2" color="gray">
                {formatDate(movie.released)}
              </Text>
              {movie.runtime_min && (
                <Text size="2" color="gray">
                  {movie.runtime_min}m
                </Text>
              )}
              {movie.genres.map((genre) => (
                <Badge key={genre} variant="soft" color="amber">
                  {genre}
                </Badge>
              ))}
            </Flex>
          </Box>

          {movie.overview && (
            <Text size="3" style={{ lineHeight: 1.6 }}>
              {movie.overview}
            </Text>
          )}

          <Flex gap="3" align="center" wrap="wrap">
            <SeenToggleButton entityId={movieId} seen={watch !== null} revalidate={path} />
            <RatingSelect
              entityType="movie"
              entityId={movieId}
              score={rating?.score ?? null}
              revalidate={path}
            />
          </Flex>
          </Flex>
        </Flex>
      </Container>
    </>
  );
}
