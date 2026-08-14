"use client";

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import Link from "next/link";
import { Button, Card, Flex, Spinner, Text } from "@radix-ui/themes";
import { MotionConfig, motion } from "motion/react";
import { FadeIn } from "@/components/FadeIn";
import { formatDate } from "@/lib/format";
import { fetchUpNext, type UpNextEpisode } from "@/lib/up-next/actions";
import { type Filters } from "@/lib/filters";
import { DateLine, UpNextRow } from "./UpNextRow";

const PAGE = 20;

/** How long the viewport must hold still before a prepend may land. */
const SCROLL_QUIET_MS = 150;

/**
 * Resolves once it is safe to prepend to a scrolled document.
 *
 * On Blink and Gecko that is immediately: they apply a same-frame
 * programmatic scroll atomically with the layout change, so the
 * prepend-plus-compensation lands invisibly even mid-scroll. WebKit's
 * compositor keeps producing frames from the stale layer tree while a
 * gesture scroll runs — a prepend mid-flick paints shifted for a few
 * frames (visible flicker), and the compensating scrollBy kills iOS
 * momentum dead, or is ignored outright during an active gesture, which
 * left the sentinel in range and chain-fired a second page. So on WebKit
 * this waits for the scroll to go quiet; applied at a standstill, the
 * compensation is exact and there is no momentum to kill. The page was
 * fetched 600px ahead of the viewport, so holding it briefly costs
 * nothing visible.
 *
 * Detected by vendor rather than by feature: the race is a trait of
 * WebKit's scrolling architecture, not of any missing API — and on iOS
 * every browser is WebKit, whatever its name.
 */
function scrollSettled(): Promise<void> {
  const webkit =
    typeof navigator !== "undefined" &&
    navigator.vendor === "Apple Computer, Inc.";
  if (!webkit) return Promise.resolve();
  return new Promise((resolve) => {
    let timer: number;
    const done = () => {
      window.removeEventListener("scroll", onScroll);
      resolve();
    };
    const onScroll = () => {
      window.clearTimeout(timer);
      timer = window.setTimeout(done, SCROLL_QUIET_MS);
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    timer = window.setTimeout(done, SCROLL_QUIET_MS);
  });
}

/**
 * The bidirectional feed: the unwatched past grows upwards, the scheduled
 * future downwards, split by an amber Today line that starts a bit above the
 * middle of the screen. Rows arrive through keyset-paginated server actions;
 * sentinels near each end trigger the next page. Prepending to a scrolled
 * document would normally yank the viewport, so the scroll position is
 * compensated by the height the new rows added.
 */
export function UpNextFeed({
  today,
  initialPast,
  initialFuture,
  synopsisMode,
  filters,
}: {
  today: string;
  initialPast: UpNextEpisode[];
  initialFuture: UpNextEpisode[];
  synopsisMode: string;
  /**
   * Must match the filters the seed pages were fetched with — the later
   * pages are fetched from here, and a page fetched under different filters
   * than the one above it would interleave rows that do not belong
   * together. The page keys this component on them, so a filter change
   * remounts rather than mixes.
   */
  filters: Filters;
}) {
  // past is newest-first (as fetched); rendered reversed so time reads
  // downwards. future is soonest-first and renders as-is.
  const [past, setPast] = useState(initialPast);
  const [future, setFuture] = useState(initialFuture);
  const [hasMorePast, setHasMorePast] = useState(initialPast.length === PAGE);
  const [hasMoreFuture, setHasMoreFuture] = useState(initialFuture.length === PAGE);
  const [loadingPast, setLoadingPast] = useState(false);
  const [loadingFuture, setLoadingFuture] = useState(false);

  const containerRef = useRef<HTMLDivElement>(null);
  const todayRef = useRef<HTMLDivElement>(null);
  const topSentinelRef = useRef<HTMLDivElement>(null);
  const bottomSentinelRef = useRef<HTMLDivElement>(null);
  const pendingScrollFix = useRef<number | null>(null);
  const busy = useRef(false);

  // Open with Today a bit above the middle of the viewport. On client-side
  // navigations Next's router scrolls the fresh segment to the top of the
  // page — and it does so after this effect, because parent lifecycles run
  // after children's. Re-assert the position from a frame callback, which
  // runs after every layout effect but still before paint, so the page never
  // flashes at the top.
  useLayoutEffect(() => {
    const scrollToToday = () => {
      const marker = todayRef.current;
      if (!marker) return;
      const target =
        marker.getBoundingClientRect().top + window.scrollY - window.innerHeight * 0.4;
      window.scrollTo({ top: Math.max(target, 0) });
    };
    scrollToToday();
    const frame = requestAnimationFrame(scrollToToday);
    return () => cancelAnimationFrame(frame);
  }, []);

  const loadPast = useCallback(async () => {
    if (busy.current) return;
    busy.current = true;
    setLoadingPast(true);
    try {
      const cursor = past[past.length - 1];
      const page = cursor
        ? await fetchUpNext(true, cursor.aired, cursor.episode_id, PAGE, filters)
        : [];
      // On WebKit, hold the page until the viewport stands still (see
      // scrollSettled). Applying mid-gesture there flickered — and iOS
      // could ignore the compensating scroll outright, which left the
      // sentinel still in range and chain-fired the next page: the feed
      // visibly expanded twice in quick succession.
      await scrollSettled();
      // Remember how tall the list is now: the layout effect below restores
      // the viewport by however much the prepended rows add.
      pendingScrollFix.current = containerRef.current?.offsetHeight ?? null;
      setPast((rows) => [...rows, ...page]);
      setHasMorePast(page.length === PAGE);
    } finally {
      setLoadingPast(false);
      busy.current = false;
    }
  }, [past, filters]);

  const loadFuture = useCallback(async () => {
    if (busy.current) return;
    busy.current = true;
    setLoadingFuture(true);
    try {
      const cursor = future[future.length - 1];
      const page = cursor
        ? await fetchUpNext(false, cursor.aired, cursor.episode_id + 1, PAGE, filters)
        : [];
      setFuture((rows) => [...rows, ...page]);
      setHasMoreFuture(page.length === PAGE);
    } finally {
      setLoadingFuture(false);
      busy.current = false;
    }
  }, [future, filters]);

  // Compensate the scroll position after a prepend commits.
  useLayoutEffect(() => {
    if (pendingScrollFix.current === null) return;
    const delta = (containerRef.current?.offsetHeight ?? 0) - pendingScrollFix.current;
    pendingScrollFix.current = null;
    if (delta > 0) window.scrollBy(0, delta);
  }, [past]);

  useEffect(() => {
    const pairs: [Element | null, () => void, boolean][] = [
      [topSentinelRef.current, loadPast, hasMorePast],
      [bottomSentinelRef.current, loadFuture, hasMoreFuture],
    ];
    const observers = pairs
      .filter(([el, , more]) => el && more)
      .map(([el, load]) => {
        const observer = new IntersectionObserver(
          (entries) => entries.some((entry) => entry.isIntersecting) && load(),
          { rootMargin: "600px 0px" }
        );
        observer.observe(el as Element);
        return observer;
      });
    return () => observers.forEach((observer) => observer.disconnect());
  }, [loadPast, loadFuture, hasMorePast, hasMoreFuture]);

  if (past.length === 0 && future.length === 0) {
    // The feed's only knob is "include watched", which can only ever ADD
    // rows — so an empty feed is an empty feed, and the answer is always
    // "go follow something".
    return (
      <FadeIn>
        <Card>
          <Flex direction="column" align="start" gap="3" p="2">
            <Text color="gray">
              Nothing here yet: this feed shows unwatched episodes of the
              shows you follow, past and upcoming. Follow a show and it
              fills up.
            </Text>
            <Flex gap="3">
              <Button asChild>
                <Link href="/app/search">Search shows</Link>
              </Button>
              <Button asChild variant="soft">
                <Link href="/app/library">Your library</Link>
              </Button>
            </Flex>
          </Flex>
        </Card>
      </FadeIn>
    );
  }

  // Chronological top to bottom: oldest unwatched first, Today, then the
  // schedule. Date lines appear when the date changes; episodes airing today
  // sit directly beneath the Today line without repeating it.
  const chronologicalPast = [...past].reverse();

  return (
    <MotionConfig reducedMotion="user">
      {/* overflow-anchor: none — the browser's scroll anchoring compensates
          a prepend on its own, and the manual compensation above cannot see
          that it did: both corrections applied, and every past page hurled
          the viewport a full page back down. One mechanism only, ours —
          anchoring is not implemented everywhere, the manual fix is. */}
      <div ref={containerRef} style={{ overflowAnchor: "none" }}>
        <div ref={topSentinelRef} />
        {/* A slot of constant height, whatever it shows. With anchoring
            off, the spinner popping into existence above the rows would
            push everything the user is reading down by its own height at
            the start of every load. */}
        <Flex justify="center" align="center" style={{ height: 44 }}>
          {loadingPast ? (
            <Spinner size="2" />
          ) : !hasMorePast ? (
            <Text size="1" color="gray">
              Nothing older left to watch.
            </Text>
          ) : null}
        </Flex>

        <Flex direction="column" gap="2">
          {chronologicalPast.map((episode, index) => {
            const distance = chronologicalPast.length - index;
            return (
              <FeedRow
                key={episode.episode_id}
                distance={distance}
                drift={-8}
                entrance={distance <= initialPast.length}
              >
                {(index === 0 ||
                  chronologicalPast[index - 1].aired !== episode.aired) && (
                  <DateLine label={formatDate(episode.aired)} />
                )}
                <UpNextRow episode={episode} aired synopsisMode={synopsisMode} />
              </FeedRow>
            );
          })}

          <div ref={todayRef}>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.2, ease: "easeOut" }}
            >
              <DateLine label="Today" today />
            </motion.div>
          </div>

          {future.map((episode, index) => (
            <FeedRow
              key={episode.episode_id}
              distance={index + 1}
              drift={8}
              entrance={index < initialFuture.length}
            >
              {episode.aired !== today &&
                (index === 0 || future[index - 1].aired !== episode.aired) && (
                  <DateLine label={formatDate(episode.aired)} />
                )}
              <UpNextRow episode={episode} aired={episode.aired <= today} synopsisMode={synopsisMode} />
            </FeedRow>
          ))}
        </Flex>

        {(loadingFuture || !hasMoreFuture) && (
          <Flex justify="center" py="3">
            {loadingFuture ? (
              <Spinner size="2" />
            ) : (
              <Text size="1" color="gray">
                Nothing scheduled further out.
              </Text>
            )}
          </Flex>
        )}
        <div ref={bottomSentinelRef} />

      </div>
    </MotionConfig>
  );
}

/**
 * One feed entry's entrance, staggered middle-out: the delay grows with the
 * row's distance from the Today line, so the feed radiates from today
 * instead of raining top-down. Every row rises into place, matching the
 * library lists — below the Today line that reads exactly like them, and
 * above it the rows lean toward today as they settle. Rows paged in later
 * skip the entrance (entrance=false) and simply appear where the scroll
 * compensation puts them.
 */
function FeedRow({
  distance,
  drift,
  entrance,
  children,
}: {
  /** 1 for the row against the Today line, growing outward. */
  distance: number;
  drift: number;
  entrance: boolean;
  children: React.ReactNode;
}) {
  return (
    <motion.div
      initial={entrance ? { opacity: 0, y: drift } : false}
      animate={{ opacity: 1, y: 0 }}
      transition={{
        duration: 0.2,
        ease: "easeOut",
        delay: Math.min(distance * 0.03, 0.4),
      }}
    >
      {children}
    </motion.div>
  );
}
