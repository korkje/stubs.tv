import Link from "next/link";
import { notFound } from "next/navigation";
import {
  Badge,
  Box,
  Card,
  Container,
  Flex,
  Heading,
  Separator,
  Text,
} from "@radix-ui/themes";
import { ChevronDownIcon, ChevronRightIcon } from "@radix-ui/react-icons";
import { ensureSeriesIngested } from "@/lib/metadata/ingest";
import { createClient } from "@/lib/supabase/server";
import { Poster } from "@/components/Poster";
import { Stat } from "@/components/Stat";
import { BulkMarkButtons } from "@/components/tracking/BulkMarkButtons";
import { EpisodeRow } from "@/components/tracking/EpisodeRow";
import { FollowButton } from "@/components/tracking/FollowButton";
import { RatingSelect } from "@/components/tracking/RatingSelect";
import { formatRuntime } from "@/lib/format";

/**
 * Seasons are collapsed by default and only the open one has its episodes
 * fetched and rendered. Workers allow 10ms of CPU per request on the free
 * plan, and rendering all 875 episodes of a long-running show blew straight
 * past it — including on the re-render that every "mark as seen" triggers.
 *
 * The open season lives in the URL so it survives those re-renders, is
 * shareable, and works with the back button.
 */
export default async function SeriesPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ season?: string }>;
}) {
  const { id } = await params;
  const { season } = await searchParams;

  const seriesId = Number(id);
  if (!Number.isInteger(seriesId)) notFound();

  await ensureSeriesIngested(seriesId);

  const supabase = await createClient();
  const path = `/app/series/${seriesId}`;

  const [{ data: series }, { data: seasons }, { data: follow }, { data: rating }] =
    await Promise.all([
      supabase.from("series").select("*").eq("id", seriesId).maybeSingle(),
      supabase
        .from("season_progress")
        .select("*")
        .eq("series_id", seriesId)
        .order("season_number"),
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

  // Specials (season 0) sort last: they are rarely what someone came for.
  const orderedSeasons = (seasons ?? []).sort((a, b) => {
    if (a.season_number === 0) return 1;
    if (b.season_number === 0) return -1;
    return (a.season_number ?? 0) - (b.season_number ?? 0);
  });

  const sum = (pick: (s: (typeof orderedSeasons)[number]) => number | null) =>
    orderedSeasons.reduce((total, s) => total + (pick(s) ?? 0), 0);

  const totals = {
    episodes: sum((s) => s.episode_count),
    aired: sum((s) => s.aired_count),
    seen: sum((s) => s.seen_count),
    runtime: sum((s) => s.runtime_min),
    seenRuntime: sum((s) => s.seen_runtime_min),
  };

  // A single-season show has nothing to choose between, so open it by default.
  const requested = season === undefined ? null : Number(season);
  const openSeason =
    requested !== null && Number.isInteger(requested)
      ? requested
      : orderedSeasons.length === 1
        ? (orderedSeasons[0].season_number ?? null)
        : null;

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
              {totals.aired > 0 && (
                <BulkMarkButtons
                  seriesId={seriesId}
                  revalidate={path}
                  allSeen={totals.seen >= totals.aired}
                  size="2"
                  label="show"
                />
              )}
            </Flex>

            <Flex gap="5" wrap="wrap">
              <Stat label="Seen" value={`${totals.seen} / ${totals.episodes}`} />
              <Stat label="Time watched" value={formatRuntime(totals.seenRuntime)} />
              <Stat label="Total runtime" value={formatRuntime(totals.runtime)} />
            </Flex>
          </Flex>
        </Flex>

        <Separator size="4" />

        {orderedSeasons.length === 0 ? (
          <Text color="gray">No episodes listed yet.</Text>
        ) : (
          <Flex direction="column" gap="3">
            {orderedSeasons.map((seasonRow) => {
              const number = seasonRow.season_number ?? 0;
              const open = openSeason === number;

              return (
                <Flex key={number} direction="column" gap="2">
                  <Flex align="center" justify="between" gap="3" wrap="wrap">
                    <Flex asChild align="center" gap="2">
                      {/* Collapsing returns to the bare path so the URL stays
                          clean when nothing is open. */}
                      <Link
                        href={open ? path : `${path}?season=${number}`}
                        scroll={false}
                        style={{ color: "inherit", textDecoration: "none" }}
                      >
                        {open ? <ChevronDownIcon /> : <ChevronRightIcon />}
                        <Heading size="4">
                          {number === 0 ? "Specials" : `Season ${number}`}
                        </Heading>
                        <Text size="2" color="gray">
                          {seasonRow.seen_count ?? 0} of {seasonRow.episode_count ?? 0} seen
                        </Text>
                      </Link>
                    </Flex>
                    {(seasonRow.aired_count ?? 0) > 0 && (
                      <BulkMarkButtons
                        seriesId={seriesId}
                        seasonNumber={number}
                        revalidate={open ? `${path}?season=${number}` : path}
                        allSeen={(seasonRow.seen_count ?? 0) >= (seasonRow.aired_count ?? 0)}
                        label={number === 0 ? "specials" : "season"}
                      />
                    )}
                  </Flex>

                  {open && (
                    <SeasonEpisodes
                      seriesId={seriesId}
                      seasonNumber={number}
                      revalidate={`${path}?season=${number}`}
                    />
                  )}
                </Flex>
              );
            })}
          </Flex>
        )}
      </Flex>
    </Container>
  );
}

/** Episodes of one season — the only place full episode rows are fetched. */
async function SeasonEpisodes({
  seriesId,
  seasonNumber,
  revalidate,
}: {
  seriesId: number;
  seasonNumber: number;
  revalidate: string;
}) {
  const supabase = await createClient();

  const [{ data: episodes }, { data: watched }] = await Promise.all([
    supabase
      .from("episodes")
      .select("*")
      .eq("series_id", seriesId)
      .eq("season_number", seasonNumber)
      .order("number"),
    supabase
      .from("watched_episodes")
      .select("episode_id")
      .eq("series_id", seriesId)
      .eq("season_number", seasonNumber),
  ]);

  const seenIds = new Set((watched ?? []).map((row) => row.episode_id));

  return (
    <Card>
      <Box px="1">
        {(episodes ?? []).map((episode, index) => (
          <EpisodeRow
            key={episode.id}
            episode={episode}
            seen={seenIds.has(episode.id)}
            revalidate={revalidate}
            last={index === (episodes ?? []).length - 1}
          />
        ))}
      </Box>
    </Card>
  );
}

