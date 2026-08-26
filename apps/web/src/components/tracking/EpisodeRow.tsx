"use client";

import { useState } from "react";
import { Box, Flex, Text } from "@radix-ui/themes";
import type { Episode } from "@stubs/db";
import { EpisodeSummary } from "./EpisodeSummary";
import { ScrambleReveal } from "@/components/ScrambleReveal";
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
  synopsisMode,
  today,
}: {
  episode: Episode;
  seen: boolean;
  revalidate: string;
  last: boolean;
  /** Spoiler protection; applies to episodes not yet seen. */
  synopsisMode: string;
  /** The user's calendar date, YYYY-MM-DD — see the series page. */
  today: string;
}) {
  // Mirrors the toggle's optimistic flip so the scramble can react to it;
  // the server prop wins again after the revalidated render arrives.
  const [marked, setMarked] = useState<boolean | null>(null);
  const effectiveSeen = marked ?? seen;

  // No toggle on an episode that has not aired, matching the feed and the
  // bulk marks: pre-marking counts it as seen the moment it comes out and
  // it never surfaces as something to watch. An unknown air date stays
  // markable — it is usually a metadata gap on something long since seen —
  // and so does an already-seen future episode, or the (bad) watch row
  // could never be removed.
  const markable = seen || episode.aired === null || episode.aired <= today;

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
          {/* In scramble mode the reveal component stays mounted either
              way — swapping to the plain summary when the server confirms
              the watch would cut the animations short. */}
          {episode.overview && synopsisMode !== "scramble" && (
            <EpisodeSummary overview={episode.overview} />
          )}
          {episode.overview && synopsisMode === "scramble" && (
            <ScrambleReveal text={episode.overview} revealed={effectiveSeen} />
          )}
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
      {markable && (
        <Box flexShrink="0" style={{ paddingTop: "2px" }}>
          <EpisodeToggle
            episodeId={episode.id}
            seen={seen}
            revalidate={revalidate}
            label={`${code} ${episode.name ?? ""}`.trim()}
            onToggled={setMarked}
          />
        </Box>
      )}
    </Flex>
  );
}
