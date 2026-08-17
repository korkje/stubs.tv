"use client";

import { useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Box, Spinner, TabNav } from "@radix-ui/themes";
import { MotionConfig, motion } from "motion/react";
import { useLibraryCounts } from "./LibraryCounts";

/**
 * The Shows/Movies tabs. Switching is a server round trip (the lists render
 * on the server), so instead of swapping to an empty pane and letting the
 * page reflow, the current list stays put and a spinner appears at the right
 * end of the tab row until the new list is ready to animate in. The spinner
 * fades in after a grace period, so prefetched or cached switches never show
 * it. The active tab moves when the content does — the two always agree.
 *
 * The links carry no filters, which is deliberate rather than an oversight:
 * the filters below belong to the Shows tab, and Movies has no notion of a
 * status or an episode length. Carrying them across would either filter on
 * fields the other tab does not have or leave dead parameters in the URL, so
 * a tab switch is a clean slate. When Movies grows facets of its own, the
 * shared ones should start travelling with the link.
 *
 * The counts come from LibraryCounts rather than props, so a toggle that
 * changes membership moves them without a server round trip.
 */
export function LibraryTabs({ movies }: { movies: boolean }) {
  const { shows: showCount, movies: movieCount } = useLibraryCounts();
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const navigate = (href: string) => (event: React.MouseEvent) => {
    // Leave modified clicks (new tab, etc.) to the browser.
    if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    event.preventDefault();
    startTransition(() => router.push(href, { scroll: false }));
  };

  return (
    <Box position="relative">
      <TabNav.Root>
        <TabNav.Link asChild active={!movies}>
          <Link href="/app/library" onClick={navigate("/app/library")}>
            Shows ({showCount})
          </Link>
        </TabNav.Link>
        <TabNav.Link asChild active={movies}>
          <Link href="/app/library?tab=movies" onClick={navigate("/app/library?tab=movies")}>
            Movies ({movieCount})
          </Link>
        </TabNav.Link>
      </TabNav.Root>
      {isPending && (
        <MotionConfig reducedMotion="user">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.25, duration: 0.2, ease: "easeOut" }}
            style={{
              position: "absolute",
              right: 0,
              top: "50%",
              transform: "translateY(-50%)",
            }}
          >
            <Spinner size="2" />
          </motion.div>
        </MotionConfig>
      )}
    </Box>
  );
}
