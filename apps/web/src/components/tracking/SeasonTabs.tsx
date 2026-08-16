"use client";

import { useEffect, useRef, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Box, Spinner, TabNav } from "@radix-ui/themes";
import { MotionConfig, motion } from "motion/react";

/**
 * The season tabs on a show page, modelled on the library's Shows/Movies
 * tabs. Switching is a server round trip (episodes render on the server, and
 * only the active season is fetched), so the current episode list stays put
 * and a spinner appears at the right end of the tab row until the new season
 * is ready. The spinner fades in after a grace period, so prefetched or
 * cached switches never show it.
 *
 * Long-running shows have more seasons than any screen has width. TabNav's
 * own list is a horizontal scroll container, so overflow takes care of
 * itself — but it always starts at the left, so the effect below scrolls
 * the active tab into view.
 */
export function SeasonTabs({
  tabs,
  active,
}: {
  tabs: { number: number; label: string; href: string }[];
  active: number;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  // Keep the active tab in view: a deep link to season 23 must not land on a
  // row scrolled to season 1. The scrollable element is TabNav's internal
  // list, so it is found by walking up from the tab rather than by ref —
  // and only the row scrolls, never the page (scrollIntoView could jump the
  // viewport). Instant on first paint (a load should not visibly drift),
  // smooth on later switches.
  const rootRef = useRef<HTMLDivElement>(null);
  const mounted = useRef(false);
  useEffect(() => {
    const root = rootRef.current;
    const tab = root?.querySelector<HTMLElement>('[aria-current="page"]');
    if (!root || !tab) return;
    let row = tab.parentElement;
    while (row && row !== root && row.scrollWidth <= row.clientWidth) {
      row = row.parentElement;
    }
    if (!row || row.scrollWidth <= row.clientWidth) return;
    const offset = tab.getBoundingClientRect().left - row.getBoundingClientRect().left;
    const target = row.scrollLeft + offset - (row.clientWidth - tab.offsetWidth) / 2;
    row.scrollTo({ left: target, behavior: mounted.current ? "smooth" : "instant" });
    mounted.current = true;
  }, [active]);

  const navigate = (href: string) => (event: React.MouseEvent) => {
    // Leave modified clicks (new tab, etc.) to the browser.
    if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    event.preventDefault();
    startTransition(() => router.push(href, { scroll: false }));
  };

  return (
    <Box position="relative" ref={rootRef}>
      <TabNav.Root>
        {tabs.map((tab) => (
          <TabNav.Link asChild key={tab.number} active={tab.number === active}>
            <Link href={tab.href} onClick={navigate(tab.href)}>
              {tab.label}
            </Link>
          </TabNav.Link>
        ))}
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
