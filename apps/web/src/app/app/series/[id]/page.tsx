import { notFound } from "next/navigation";
import {
  Badge,
  Box,
  Card,
  Container,
  Flex,
  Heading,
  Separator,
  Table,
  Text,
} from "@radix-ui/themes";
import type { Episode } from "@stubs/db";
import { ensureSeriesIngested } from "@/lib/metadata/ingest";
import { createClient } from "@/lib/supabase/server";
import { Poster } from "@/components/Poster";
import { formatDate, formatRuntime } from "@/lib/format";

export default async function SeriesPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const seriesId = Number(id);
  if (!Number.isInteger(seriesId)) notFound();

  // Fills the cache on first view and refreshes it when stale; no-op otherwise.
  await ensureSeriesIngested(seriesId);

  const supabase = await createClient();

  const [{ data: series }, { data: episodes }] = await Promise.all([
    supabase.from("series").select("*").eq("id", seriesId).maybeSingle(),
    supabase
      .from("episodes")
      .select("*")
      .eq("series_id", seriesId)
      .order("season_number")
      .order("number"),
  ]);

  if (!series) notFound();

  const bySeason = groupBySeason(episodes ?? []);
  const totalRuntime = (episodes ?? []).reduce((sum, e) => sum + (e.runtime_min ?? 0), 0);

  return (
    <Container size="4" px="4">
      <Flex direction="column" gap="6">
        <Flex gap="5" align="start" wrap="wrap">
          <Poster url={series.poster_url} alt={series.name} width={160} />
          <Flex direction="column" gap="3" style={{ flex: "1 1 320px" }}>
            <Box>
              <Heading size="7">{series.name}</Heading>
              <Flex align="center" gap="2" mt="1" wrap="wrap">
                {series.first_aired && (
                  <Text size="2" color="gray">
                    {series.first_aired.slice(0, 4)}
                  </Text>
                )}
                {series.status && (
                  <Badge variant="soft" color="gray">
                    {series.status}
                  </Badge>
                )}
                {series.genres.map((genre) => (
                  <Badge key={genre} variant="soft" color="amber">
                    {genre}
                  </Badge>
                ))}
              </Flex>
            </Box>

            {series.overview && (
              <Text size="3" style={{ lineHeight: 1.6 }}>
                {series.overview}
              </Text>
            )}

            <Flex gap="5" wrap="wrap">
              <Stat label="Episodes" value={String(episodes?.length ?? 0)} />
              <Stat label="Total runtime" value={formatRuntime(totalRuntime)} />
            </Flex>
          </Flex>
        </Flex>

        <Separator size="4" />

        {bySeason.length === 0 ? (
          <Text color="gray">No episodes listed yet.</Text>
        ) : (
          bySeason.map(({ seasonNumber, episodes: seasonEpisodes }) => (
            <Flex key={seasonNumber} direction="column" gap="2">
              <Heading size="4">
                {seasonNumber === 0 ? "Specials" : `Season ${seasonNumber}`}
                <Text size="2" color="gray" weight="regular">
                  {"  "}
                  {seasonEpisodes.length} episodes
                </Text>
              </Heading>
              <Card>
                <Table.Root size="1" variant="ghost">
                  <Table.Body>
                    {seasonEpisodes.map((episode) => (
                      <Table.Row key={episode.id}>
                        <Table.Cell width="56px">
                          <Text color="gray">
                            {seasonNumber}×{String(episode.number).padStart(2, "0")}
                          </Text>
                        </Table.Cell>
                        <Table.Cell>{episode.name ?? "Untitled"}</Table.Cell>
                        <Table.Cell width="120px">
                          <Text color="gray">{formatDate(episode.aired)}</Text>
                        </Table.Cell>
                        <Table.Cell width="80px">
                          <Text color="gray">
                            {episode.runtime_min ? `${episode.runtime_min}m` : "—"}
                          </Text>
                        </Table.Cell>
                      </Table.Row>
                    ))}
                  </Table.Body>
                </Table.Root>
              </Card>
            </Flex>
          ))
        )}
      </Flex>
    </Container>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <Flex direction="column">
      <Text size="1" color="gray">
        {label}
      </Text>
      <Text size="4" weight="medium">
        {value}
      </Text>
    </Flex>
  );
}

/** Groups episodes by season, with specials (season 0) last. */
function groupBySeason(episodes: Episode[]) {
  const groups = new Map<number, Episode[]>();

  for (const episode of episodes) {
    const existing = groups.get(episode.season_number);
    if (existing) existing.push(episode);
    else groups.set(episode.season_number, [episode]);
  }

  return [...groups.entries()]
    .map(([seasonNumber, seasonEpisodes]) => ({ seasonNumber, episodes: seasonEpisodes }))
    .sort((a, b) => {
      if (a.seasonNumber === 0) return 1;
      if (b.seasonNumber === 0) return -1;
      return a.seasonNumber - b.seasonNumber;
    });
}
