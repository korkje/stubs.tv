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
import { BulkMarkButtons } from "@/components/tracking/BulkMarkButtons";
import { EpisodeToggle } from "@/components/tracking/EpisodeToggle";
import { FollowButton } from "@/components/tracking/FollowButton";
import { RatingSelect } from "@/components/tracking/RatingSelect";
import { formatDate, formatRuntime } from "@/lib/format";

export default async function SeriesPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const seriesId = Number(id);
  if (!Number.isInteger(seriesId)) notFound();

  // Fills the cache on first view and refreshes it when stale; no-op otherwise.
  await ensureSeriesIngested(seriesId);

  const supabase = await createClient();
  const path = `/app/series/${seriesId}`;

  const [{ data: series }, { data: episodes }, { data: follow }, { data: rating }] =
    await Promise.all([
      supabase.from("series").select("*").eq("id", seriesId).maybeSingle(),
      supabase
        .from("episodes")
        .select("*")
        .eq("series_id", seriesId)
        .order("season_number")
        .order("number"),
      supabase
        .from("follows")
        .select("entity_id")
        .eq("entity_type", "series")
        .eq("entity_id", seriesId)
        .maybeSingle(),
      supabase
        .from("ratings")
        .select("score")
        .eq("entity_type", "series")
        .eq("entity_id", seriesId)
        .maybeSingle(),
    ]);

  if (!series) notFound();

  const allEpisodes = episodes ?? [];
  const episodeIds = allEpisodes.map((episode) => episode.id);

  // Bulk marks must never cover episodes that have not aired: they would be
  // "seen" the moment they come out and would never appear as something to
  // watch. Individual toggles stay unrestricted on purpose.
  const today = new Date().toISOString().slice(0, 10);
  const hasAired = (episode: Episode) => episode.aired !== null && episode.aired <= today;
  const airedIds = allEpisodes.filter(hasAired).map((episode) => episode.id);

  // RLS scopes this to the signed-in user, so no user filter is needed here.
  const { data: watches } = episodeIds.length
    ? await supabase
        .from("watches")
        .select("entity_id")
        .eq("entity_type", "episode")
        .in("entity_id", episodeIds)
    : { data: [] };

  const seenIds = new Set((watches ?? []).map((watch) => watch.entity_id));
  const bySeason = groupBySeason(allEpisodes);

  const totalRuntime = allEpisodes.reduce((sum, e) => sum + (e.runtime_min ?? 0), 0);
  const seenRuntime = allEpisodes
    .filter((e) => seenIds.has(e.id))
    .reduce((sum, e) => sum + (e.runtime_min ?? 0), 0);

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

            <Flex gap="3" align="center" wrap="wrap">
              <FollowButton
                seriesId={seriesId}
                following={follow !== null}
                revalidate={path}
              />
              <RatingSelect
                entityType="series"
                entityId={seriesId}
                score={rating?.score ?? null}
                revalidate={path}
              />
              {/* Covers specials too — they are episodes like any other. */}
              {airedIds.length > 0 && (
                <BulkMarkButtons
                  episodeIds={airedIds}
                  revalidate={path}
                  allSeen={airedIds.every((airedId) => seenIds.has(airedId))}
                  size="2"
                  label="whole show"
                />
              )}
            </Flex>

            <Flex gap="5" wrap="wrap">
              <Stat
                label="Seen"
                value={`${seenIds.size} / ${allEpisodes.length}`}
              />
              <Stat label="Time watched" value={formatRuntime(seenRuntime)} />
              <Stat label="Total runtime" value={formatRuntime(totalRuntime)} />
            </Flex>
          </Flex>
        </Flex>

        <Separator size="4" />

        {bySeason.length === 0 ? (
          <Text color="gray">No episodes listed yet.</Text>
        ) : (
          bySeason.map(({ seasonNumber, episodes: seasonEpisodes }) => {
            const seasonSeen = seasonEpisodes.filter((episode) =>
              seenIds.has(episode.id)
            ).length;
            const seasonAiredIds = seasonEpisodes.filter(hasAired).map((e) => e.id);

            return (
              <Flex key={seasonNumber} direction="column" gap="2">
                <Flex align="center" justify="between" gap="3" wrap="wrap">
                  <Heading size="4">
                    {seasonNumber === 0 ? "Specials" : `Season ${seasonNumber}`}
                    <Text size="2" color="gray" weight="regular">
                      {"  "}
                      {seasonSeen} of {seasonEpisodes.length} seen
                    </Text>
                  </Heading>
                  {seasonAiredIds.length > 0 && (
                    <BulkMarkButtons
                      episodeIds={seasonAiredIds}
                      revalidate={path}
                      allSeen={seasonAiredIds.every((airedId) => seenIds.has(airedId))}
                      label={seasonNumber === 0 ? "specials" : "season"}
                    />
                  )}
                </Flex>
                <Card>
                  <Table.Root size="1" variant="ghost">
                    <Table.Body>
                      {seasonEpisodes.map((episode) => (
                        <Table.Row key={episode.id}>
                          <Table.Cell width="40px">
                            <EpisodeToggle
                              episodeId={episode.id}
                              seen={seenIds.has(episode.id)}
                              revalidate={path}
                              label={`${seasonNumber}x${episode.number} ${episode.name ?? ""}`}
                            />
                          </Table.Cell>
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
            );
          })
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
