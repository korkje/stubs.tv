"use client";

import { useRef, useState } from "react";
import Link from "next/link";
import { Box, Card, Flex, IconButton, Text } from "@radix-ui/themes";
import { EyeNoneIcon, EyeOpenIcon } from "@radix-ui/react-icons";
import { easeIn, easeOut, motion, useReducedMotion, useScroll, useTransform } from "motion/react";
import { Poster } from "@/components/Poster";
import { ScrambleReveal } from "@/components/ScrambleReveal";
import { markSeen, unmarkSeen } from "@/lib/tracking/actions";
import type { UpNextEpisode } from "@/lib/up-next/actions";

/**
 * One episode in the up-next feed: the library-row look, carrying the show
 * name with the episode underneath, a two-line synopsis where one exists,
 * and the seen eye on the right for aired episodes.
 *
 * The row scales down and fades as it approaches the viewport's top or
 * bottom, which keeps the eye on the middle of the timeline. That lens is a
 * scroll-linked style, not an animation, so MotionConfig cannot suppress it —
 * it is gated on the reduced-motion preference by hand.
 */
export function UpNextRow({
  episode,
  aired,
  synopsisMode,
}: {
  episode: UpNextEpisode;
  aired: boolean;
  synopsisMode: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const reduceMotion = useReducedMotion();
  // Lifted from the toggle: marking seen also unscrambles the synopsis.
  const [seen, setSeen] = useState(false);

  // Progress runs from the row entering at the bottom of the viewport to it
  // disappearing under the sticky nav — "end 56px" (the nav's height), not
  // "end start", or the top half of the fade plays hidden behind the bar and
  // the lens looks weaker at the top than the bottom.
  //
  // Easing is directional on purpose: each fade segment is gentle where it
  // meets the full-size plateau (no flat-to-linear kink) but keeps its
  // velocity at the viewport edge, so rows visibly go on shrinking until
  // they are actually gone — easeInOut here reads as the shrink stalling
  // just before the exit. The middle segment is constant, its ease is moot.
  const { scrollYProgress } = useScroll({
    target: ref,
    offset: ["start end", "end 56px"],
  });
  const lens = { ease: [easeOut, easeOut, easeIn] };
  const opacity = useTransform(scrollYProgress, [0, 0.2, 0.8, 1], [0.35, 1, 1, 0.35], lens);
  const scale = useTransform(scrollYProgress, [0, 0.2, 0.8, 1], [0.96, 1, 1, 0.96], lens);

  const code = `${episode.season_number}×${String(episode.episode_number).padStart(2, "0")}`;

  return (
    <motion.div
      ref={ref}
      style={reduceMotion ? undefined : { opacity, scale }}
    >
      <Card asChild>
        <Link href={`/app/series/${episode.series_id}?season=${episode.season_number}`}>
          <Flex gap="4" align="start">
            <Poster url={episode.poster_url} alt={episode.series_name} width={56} />
            <Flex direction="column" gap="1" flexGrow="1" style={{ minWidth: 0 }}>
              <Flex justify="between" align="start" gap="2">
                <Text weight="bold" size="3">
                  {episode.series_name}
                </Text>
                {aired && (
                  <Flex
                    align="center"
                    flexShrink="0"
                    style={{ height: "var(--line-height-3)" }}
                  >
                    <SeenToggle episode={episode} code={code} seen={seen} onChange={setSeen} />
                  </Flex>
                )}
              </Flex>
              <Flex align="center" gap="2" wrap="wrap">
                <Text size="1" color="gray" style={{ fontVariantNumeric: "tabular-nums" }}>
                  {code}
                </Text>
                <Text size="2">{episode.episode_name ?? "Untitled"}</Text>
              </Flex>
              {/* Everything in this feed is unwatched, so the spoiler
                  setting applies to every synopsis. */}
              {episode.overview && synopsisMode === "show" ? (
                <Text as="div" size="1" color="gray" className="clamp-2-lines">
                  {episode.overview}
                </Text>
              ) : null}
              {episode.overview && synopsisMode === "scramble" ? (
                <ScrambleReveal text={episode.overview} revealed={seen} />
              ) : null}
            </Flex>
          </Flex>
        </Link>
      </Card>
    </motion.div>
  );
}

/**
 * Seen toggle owning its state locally: this feed's rows live in client
 * state, so the optimistic-against-server-prop pattern the other toggles use
 * would snap back — here the click is the truth. Revalidates the library
 * rather than this route, so the feed does not reload under the user.
 */
function SeenToggle({
  episode,
  code,
  seen,
  onChange,
}: {
  episode: UpNextEpisode;
  code: string;
  seen: boolean;
  onChange: (seen: boolean) => void;
}) {
  const label = `${episode.series_name} ${code}`;

  return (
    <IconButton
      variant="ghost"
      color={seen ? "amber" : "gray"}
      aria-label={seen ? `Mark ${label} as not seen` : `Mark ${label} as seen`}
      aria-pressed={seen}
      onClick={async (event) => {
        event.preventDefault();
        event.stopPropagation();
        const next = !seen;
        onChange(next);
        try {
          if (next) await markSeen("episode", episode.episode_id, "/app/library");
          else await unmarkSeen("episode", episode.episode_id, "/app/library");
        } catch {
          onChange(!next);
        }
      }}
    >
      {seen ? <EyeOpenIcon /> : <EyeNoneIcon />}
    </IconButton>
  );
}

export function DateLine({ label, today }: { label: string; today?: boolean }) {
  return (
    <Flex align="center" gap="3" pt="4" pb="1">
      <Text
        size="1"
        weight={today ? "bold" : "medium"}
        color={today ? undefined : "gray"}
        style={today ? { color: "var(--amber-9)" } : undefined}
      >
        {label}
      </Text>
      <Box
        flexGrow="1"
        style={{
          borderTop: `1px solid ${today ? "var(--amber-a6)" : "var(--gray-a4)"}`,
        }}
      />
    </Flex>
  );
}
