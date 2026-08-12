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
import { ensureSeriesIngested } from "@/lib/metadata/ingest";
import { createClient } from "@/lib/supabase/server";
import { Backdrop } from "@/components/Backdrop";
import { Collapse } from "@/components/Collapse";
import { FadeIn } from "@/components/FadeIn";
import { SeasonHeader } from "@/components/tracking/SeasonHeader";
import { StaggerIn } from "@/components/StaggerIn";
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

  const [{ data: series }, { data: seasons }, { data: follow }, { data: rating }, { data: profile }] =
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
      supabase
        .from("profiles")
        .select("specials, synopsis_mode")
        .maybeSingle(),
    ]);

  if (!series) notFound();

  const settings = {
    specials: profile?.specials ?? "uncounted",
    synopsisMode: profile?.synopsis_mode ?? "show",
  };

  // Specials (season 0) sort last: they are rarely what someone came for —
  // or nowhere at all, for users who hide them.
  const visibleSeasons =
    settings.specials === "hidden"
      ? (seasons ?? []).filter((row) => row.season_number !== 0)
      : (seasons ?? []);
  const orderedSeasons = visibleSeasons.sort((a, b) => {
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

  // Any number of seasons can be open at once; the set lives in the URL as
  // a comma list. A single-season show has nothing to choose between, so it
  // opens by default.
  const openSeasons = new Set(
    (season ?? "")
      .split(",")
      .filter((part) => part !== "")
      .map(Number)
      .filter(Number.isInteger)
  );
  if (season === undefined && orderedSeasons.length === 1) {
    openSeasons.add(orderedSeasons[0].season_number ?? 0);
  }

  // Toggling a season adds or removes it from the list; an empty list
  // returns to the bare path so the URL stays clean when nothing is open.
  const seasonHref = (number: number) => {
    const next = new Set(openSeasons);
    if (next.has(number)) next.delete(number);
    else next.add(number);
    const list = [...next].sort((a, b) => a - b).join(",");
    return list ? `${path}?season=${list}` : path;
  };

  return (
    <FadeIn>
      {/* Outside the Container so it can run the full width of the screen. */}
      {series.backdrop_url && <Backdrop url={series.backdrop_url} alt={series.name} />}
      <Container size="3" px="4">
        <Flex direction="column" gap="6">
          <Flex gap="5" align="start" wrap="wrap" position="relative">
          <Box display={series.backdrop_url ? { initial: "none", sm: "block" } : undefined}>
            <Poster url={series.poster_url} alt={series.name} width={160} />
          </Box>
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
              const open = openSeasons.has(number);

              return (
                <Flex key={number} direction="column" gap="2">
                  <Flex align="center" justify="between" gap="3" wrap="wrap">
                    <SeasonHeader
                      href={seasonHref(number)}
                      open={open}
                      title={number === 0 ? "Specials" : `Season ${number}`}
                      subtitle={`${seasonRow.seen_count ?? 0} of ${seasonRow.episode_count ?? 0} seen`}
                    />
                    {(seasonRow.aired_count ?? 0) > 0 && (
                      <BulkMarkButtons
                        seriesId={seriesId}
                        seasonNumber={number}
                        revalidate={path}
                        allSeen={(seasonRow.seen_count ?? 0) >= (seasonRow.aired_count ?? 0)}
                        label={number === 0 ? "specials" : "season"}
                      />
                    )}
                  </Flex>

                  <Collapse>
                    {open && (
                      <SeasonEpisodes
                        seriesId={seriesId}
                        seasonNumber={number}
                        revalidate={path}
                        synopsisMode={settings.synopsisMode}
                      />
                    )}
                  </Collapse>
                </Flex>
              );
            })}
          </Flex>
          )}
        </Flex>
      </Container>
    </FadeIn>
  );
}

/** Episodes of one season — the only place full episode rows are fetched. */
async function SeasonEpisodes({
  seriesId,
  seasonNumber,
  revalidate,
  synopsisMode,
}: {
  seriesId: number;
  seasonNumber: number;
  revalidate: string;
  synopsisMode: string;
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
        <StaggerIn>
          {(episodes ?? []).map((episode, index) => (
            <EpisodeRow
              key={episode.id}
              episode={episode}
              seen={seenIds.has(episode.id)}
              revalidate={revalidate}
              last={index === (episodes ?? []).length - 1}
              synopsisMode={synopsisMode}
            />
          ))}
        </StaggerIn>
      </Box>
    </Card>
  );
}

