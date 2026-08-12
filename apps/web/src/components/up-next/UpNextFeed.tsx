"use client";

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import Link from "next/link";
import { Button, Card, Flex, Spinner, Text } from "@radix-ui/themes";
import { FadeIn } from "@/components/FadeIn";
import { formatDate } from "@/lib/format";
import { fetchUpNext, type UpNextEpisode } from "@/lib/up-next/actions";
import { DateLine, UpNextRow } from "./UpNextRow";

const PAGE = 20;

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
}: {
  today: string;
  initialPast: UpNextEpisode[];
  initialFuture: UpNextEpisode[];
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

  // Open with Today a bit above the middle of the viewport.
  useLayoutEffect(() => {
    const marker = todayRef.current;
    if (!marker) return;
    const target =
      marker.getBoundingClientRect().top + window.scrollY - window.innerHeight * 0.4;
    window.scrollTo({ top: Math.max(target, 0) });
  }, []);

  const loadPast = useCallback(async () => {
    if (busy.current) return;
    busy.current = true;
    setLoadingPast(true);
    try {
      const cursor = past[past.length - 1];
      const page = cursor
        ? await fetchUpNext(true, cursor.aired, cursor.episode_id, PAGE)
        : [];
      // Remember how tall the list is now: the layout effect below restores
      // the viewport by however much the prepended rows add.
      pendingScrollFix.current = containerRef.current?.offsetHeight ?? null;
      setPast((rows) => [...rows, ...page]);
      setHasMorePast(page.length === PAGE);
    } finally {
      setLoadingPast(false);
      busy.current = false;
    }
  }, [past]);

  const loadFuture = useCallback(async () => {
    if (busy.current) return;
    busy.current = true;
    setLoadingFuture(true);
    try {
      const cursor = future[future.length - 1];
      const page = cursor
        ? await fetchUpNext(false, cursor.aired, cursor.episode_id + 1, PAGE)
        : [];
      setFuture((rows) => [...rows, ...page]);
      setHasMoreFuture(page.length === PAGE);
    } finally {
      setLoadingFuture(false);
      busy.current = false;
    }
  }, [future]);

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
    return (
      <FadeIn>
        <Card>
          <Flex direction="column" align="start" gap="3" p="2">
            <Text color="gray">
              Nothing here yet: this feed shows unwatched episodes of the shows
              you follow, past and upcoming. Follow a show and it fills up.
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
    <FadeIn>
      <div ref={containerRef}>
        <div ref={topSentinelRef} />
        {(loadingPast || !hasMorePast) && (
          <Flex justify="center" py="3">
            {loadingPast ? (
              <Spinner size="2" />
            ) : (
              <Text size="1" color="gray">
                Nothing older left to watch.
              </Text>
            )}
          </Flex>
        )}

        <Flex direction="column" gap="2">
          {chronologicalPast.map((episode, index) => (
            <div key={episode.episode_id}>
              {(index === 0 ||
                chronologicalPast[index - 1].aired !== episode.aired) && (
                <DateLine label={formatDate(episode.aired)} />
              )}
              <UpNextRow episode={episode} aired />
            </div>
          ))}

          <div ref={todayRef}>
            <DateLine label="Today" today />
          </div>

          {future.map((episode, index) => (
            <div key={episode.episode_id}>
              {episode.aired !== today &&
                (index === 0 || future[index - 1].aired !== episode.aired) && (
                  <DateLine label={formatDate(episode.aired)} />
                )}
              <UpNextRow episode={episode} aired={episode.aired <= today} />
            </div>
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
    </FadeIn>
  );
}
