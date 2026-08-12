import { Box, Flex, Text } from "@radix-ui/themes";
import type { Episode } from "@stubs/db";
import { EpisodeSummary } from "./EpisodeSummary";
import { EpisodeToggle } from "./EpisodeToggle";
import { formatDate } from "@/lib/format";

/**
 * One episode in a season listing.
 *
 * Deliberately not a table: five fixed columns squeeze the title and synopsis
 * into unreadable slivers on a phone. Here the air date and runtime sit beside
 * the title on wide screens and drop underneath it on narrow ones.
 */
export function EpisodeRow({
  episode,
  seen,
  revalidate,
  last,
}: {
  episode: Episode;
  seen: boolean;
  revalidate: string;
  last: boolean;
}) {
  const code = `${episode.season_number}×${String(episode.number).padStart(2, "0")}`;

  return (
    <Flex
      gap="3"
      align="start"
      py="3"
      style={
        last ? undefined : { borderBottom: "1px solid var(--gray-a4)" }
      }
    >
      <Flex
        direction={{ initial: "column", sm: "row" }}
        gap={{ initial: "1", sm: "4" }}
        flexGrow="1"
        style={{ minWidth: 0 }}
      >
        <Box flexGrow="1" style={{ minWidth: 0 }}>
          <Flex align="baseline" gap="2">
            <Text size="1" color="gray" style={{ fontVariantNumeric: "tabular-nums" }}>
              {code}
            </Text>
            <Text size="2" weight="medium">
              {episode.name ?? "Untitled"}
            </Text>
          </Flex>
          {episode.overview && <EpisodeSummary overview={episode.overview} />}
        </Box>

        <Flex gap="3" flexShrink="0">
          <Text size="1" color="gray" style={{ fontVariantNumeric: "tabular-nums" }}>
            {formatDate(episode.aired)}
          </Text>
          <Text size="1" color="gray" style={{ fontVariantNumeric: "tabular-nums" }}>
            {episode.runtime_min ? `${episode.runtime_min}m` : "—"}
          </Text>
        </Flex>
      </Flex>

      {/* On the right like the library rows' toggles — easier to reach.
          Nudged down so the icon sits on the first line of text. */}
      <Box flexShrink="0" style={{ paddingTop: "2px" }}>
        <EpisodeToggle
          episodeId={episode.id}
          seen={seen}
          revalidate={revalidate}
          label={`${code} ${episode.name ?? ""}`.trim()}
        />
      </Box>
    </Flex>
  );
}
