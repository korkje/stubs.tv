import { notFound } from "next/navigation";
import { Badge, Box, Container, Flex, Heading, Text } from "@radix-ui/themes";
import { ensureMovieIngested } from "@/lib/metadata/ingest";
import { createClient } from "@/lib/supabase/server";
import { Poster } from "@/components/Poster";
import { formatDate } from "@/lib/format";

export default async function MoviePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const movieId = Number(id);
  if (!Number.isInteger(movieId)) notFound();

  await ensureMovieIngested(movieId);

  const supabase = await createClient();
  const { data: movie } = await supabase.from("movies").select("*").eq("id", movieId).maybeSingle();

  if (!movie) notFound();

  return (
    <Container size="4" px="4">
      <Flex gap="5" align="start" wrap="wrap">
        <Poster url={movie.poster_url} alt={movie.name} width={160} />
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
        </Flex>
      </Flex>
    </Container>
  );
}
