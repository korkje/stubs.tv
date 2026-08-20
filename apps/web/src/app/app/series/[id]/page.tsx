import { notFound } from "next/navigation";
import NumberFlow from "@number-flow/react";
import {
  Badge,
  Box,
  Card,
  Container,
  Flex,
  Heading,
  Text,
} from "@radix-ui/themes";
import { ensureSeriesIngested } from "@/lib/metadata/ingest";
import { createClient } from "@/lib/supabase/server";
import { Backdrop } from "@/components/Backdrop";
import { FadeIn } from "@/components/FadeIn";
import { Overview } from "@/components/Overview";
import { SeasonTabs } from "@/components/tracking/SeasonTabs";
import { StaggerIn } from "@/components/StaggerIn";
import { Poster } from "@/components/Poster";
import { Stat } from "@/components/Stat";
import { TimeFigure } from "@/components/TimeStat";
import { BulkMarkButtons } from "@/components/tracking/BulkMarkButtons";
import { EpisodeRow } from "@/components/tracking/EpisodeRow";
import { FollowButton } from "@/components/tracking/FollowButton";
import { RatingSelect } from "@/components/tracking/RatingSelect";

/**
 * Seasons render one at a time behind a tab row (the same pattern as the
 * library's Shows/Movies tabs). Workers allow 10ms of CPU per request on the
 * free plan, and rendering all 875 episodes of a long-running show blew
 * straight past it — including on the re-render that every "mark as seen"
 * triggers. The tabs make that constraint the interface: exactly one
 * season's episodes are fetched and rendered per request.
 *
 * The active season lives in the URL so it survives those re-renders, is
 * shareable, and works with the back button. Links from the accordion era
 * carried a comma list (?season=1,3); the first entry naming a real season
 * wins, so old links still land on a sensible tab.
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
        .select("specials, bulk_mark_specials, synopsis_mode")
        .maybeSingle(),
    ]);

  if (!series) notFound();

  const settings = {
    specials: profile?.specials ?? "uncounted",
    bulkMarkSpecials: profile?.bulk_mark_specials ?? true,
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

  const sum = (
    rows: typeof orderedSeasons,
    pick: (s: (typeof orderedSeasons)[number]) => number | null
  ) => rows.reduce((total, s) => total + (pick(s) ?? 0), 0);

  const totals = {
    episodes: sum(orderedSeasons, (s) => s.episode_count),
    aired: sum(orderedSeasons, (s) => s.aired_count),
    seen: sum(orderedSeasons, (s) => s.seen_count),
    runtime: sum(orderedSeasons, (s) => s.runtime_min),
    seenRuntime: sum(orderedSeasons, (s) => s.seen_runtime_min),
  };

  // "Mark show" sweeps only the seasons the bulk_mark_specials switch says it
  // does, so its all-seen state must be judged over that same set. Counting
  // unswept specials would pin the button at "Mark show" no matter how many
  // times it is clicked.
  const sweepSeasons = settings.bulkMarkSpecials
    ? orderedSeasons
    : orderedSeasons.filter((row) => row.season_number !== 0);
  const sweep = {
    aired: sum(sweepSeasons, (s) => s.aired_count),
    seen: sum(sweepSeasons, (s) => s.seen_count),
  };

  // The requested season only counts if it names a season the show has (and
  // that the specials setting shows); anything else falls back to the first
  // tab rather than a dead page.
  const requested = (season ?? "")
    .split(",")
    .filter((part) => part !== "")
    .map(Number)
    .find((n) => orderedSeasons.some((row) => (row.season_number ?? 0) === n));
  const defaultNumber = orderedSeasons[0]?.season_number ?? 0;
  const activeNumber = requested ?? defaultNumber;
  const activeSeason = orderedSeasons.find(
    (row) => (row.season_number ?? 0) === activeNumber
  );

  // The default tab links to the bare path so the canonical URL stays clean.
  const tabs = orderedSeasons.map((row) => {
    const number = row.season_number ?? 0;
    return {
      number,
      label: number === 0 ? "Specials" : `Season ${number}`,
      href: number === defaultNumber ? path : `${path}?season=${number}`,
    };
  });

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

            {series.overview && <Overview text={series.overview} />}

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
              {sweep.aired > 0 && (
                <BulkMarkButtons
                  seriesId={seriesId}
                  revalidate={path}
                  allSeen={sweep.seen >= sweep.aired}
                  size="2"
                  label="show"
                />
              )}
            </Flex>

            <Flex gap="5" wrap="wrap">
              {/* The seen count rolls with every mark; the total only moves
                  with metadata. Digits are tabular globally, so the row
                  doesn't wander mid-roll. */}
              <Stat
                label="Seen"
                value={
                  <span style={{ whiteSpace: "nowrap" }}>
                    <NumberFlow value={totals.seen} /> / {totals.episodes}
                  </span>
                }
              />
              {/* Animated, no arrival roll: every mark on this page
                  revalidates it, so the mounted figure receives the new
                  minutes and rolls from where it stands. */}
              <Stat
                label="Time watched"
                value={<TimeFigure minutes={totals.seenRuntime} arrive={false} />}
              />
              {/* Same quiet-units styling as Time watched; it only changes
                  when metadata does, but consistency is the point. */}
              <Stat
                label="Total runtime"
                value={<TimeFigure minutes={totals.runtime} arrive={false} />}
              />
            </Flex>
          </Flex>
        </Flex>

        {activeSeason === undefined ? (
          <Text color="gray">No episodes listed yet.</Text>
        ) : (
          <Flex direction="column" gap="3">
            <SeasonTabs tabs={tabs} active={activeNumber} />

            <Flex align="center" justify="between" gap="3" wrap="wrap">
              <Text size="2" color="gray">
                {activeSeason.seen_count ?? 0} of {activeSeason.episode_count ?? 0} seen
              </Text>
              {(activeSeason.aired_count ?? 0) > 0 && (
                <BulkMarkButtons
                  seriesId={seriesId}
                  seasonNumber={activeNumber}
                  revalidate={path}
                  allSeen={(activeSeason.seen_count ?? 0) >= (activeSeason.aired_count ?? 0)}
                  label={activeNumber === 0 ? "specials" : "season"}
                />
              )}
            </Flex>

            {/* Keyed by season so a switch mounts the list fresh and the
                stagger entrance replays — the library gets the same remount
                for free from its tabs being two different components. A
                revalidation (marking episodes) keeps the key, so it swaps
                in place without re-animating. */}
            <SeasonEpisodes
              key={activeNumber}
              seriesId={seriesId}
              seasonNumber={activeNumber}
              revalidate={path}
              synopsisMode={settings.synopsisMode}
            />
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

