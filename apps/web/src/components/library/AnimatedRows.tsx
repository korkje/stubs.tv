"use client";

import { useState } from "react";
import { AnimatePresence, MotionConfig, motion } from "motion/react";

/**
 * A row with its identity carried EXPLICITLY, not as a React key. The
 * distinction matters: these rows are server-rendered, and while element
 * keys survive the initial SSR payload, an RSC update from a soft
 * navigation delivers the same children with their keys stripped to
 * positions. Identity by key therefore breaks exactly when it matters —
 * mid-filter-change — making every surviving row look like a departure
 * plus an arrival, so the whole list exits over itself while its
 * replacement animates in.
 */
export interface AnimatedRow {
  /** Stable and data-derived (an internal id), unique within the list. */
  id: string;
  node: React.ReactNode;
}

/**
 * List wrapper that animates rows in and out. Each row is two layers: an
 * outer div that owns the row's vertical space (including the list gap, so
 * it can collapse away smoothly) and an inner div that owns the content.
 * Removing a row fades the content out first, then closes the gap — the
 * sequencing is what keeps it from looking like the list snapping shut. On
 * the list's first mount the rows fade up with a small stagger — that IS the
 * loading choreography, there are deliberately no content skeletons — and
 * rows added to an already-mounted list expand into place.
 *
 * It is a client component receiving server-rendered rows: AnimatePresence
 * keeps a departed child around just long enough to play the exit.
 *
 * The diff animation is for lists that overlap. `remountOn` takes values
 * whose change means the old and new lists are disjoint by construction:
 * the surface's single-choice facets ("Ended" → "Ongoing", Following → Not
 * following), and whether the list is showing results or its empty-state
 * card. Watching every row collapse while a whole other list expands is
 * churn, not continuity — so on such a change the list remounts and plays
 * its entrance instead. Null at either end of a facet change means "All"
 * was involved: one list contains the other, and the diff is the point.
 * The host can only say what the values are NOW, so the previous values
 * are remembered here.
 */
export function AnimatedRows({
  rows,
  remountOn = [],
}: {
  rows: AnimatedRow[];
  remountOn?: readonly (string | boolean | null)[];
}) {
  const [prevRemountOn, setPrevRemountOn] = useState(remountOn);
  const [epoch, setEpoch] = useState(0);
  if (
    prevRemountOn.length !== remountOn.length ||
    prevRemountOn.some((value, i) => value !== remountOn[i])
  ) {
    setPrevRemountOn(remountOn);
    if (
      prevRemountOn.some(
        (value, i) =>
          value !== null && remountOn[i] !== null && value !== remountOn[i]
      )
    ) {
      setEpoch(epoch + 1);
    }
  }

  return <RowList key={epoch} rows={rows} />;
}

function RowList({ rows }: { rows: AnimatedRow[] }) {
  // The ids whose rows were present at mount AND have been here since:
  // those got the staggered entrance (their `initial` was locked when they
  // mounted; the set is irrelevant to them afterwards). The set exists for
  // rows that LEAVE — a departure deletes its id, so a row that was here
  // at mount, left with a filter, and came back reads as new and expands
  // into place. Keeping departed ids forever was an earlier bug: the
  // return of such a row got `initial={false}` and popped in full-height
  // while its neighbours animated. Deletions happen via adjust-during-
  // render; nothing is ever added, because a newcomer's entrance is
  // decided once, at its own mount.
  const [atMountIds, setAtMountIds] = useState(
    () => new Set(rows.map((row) => row.id))
  );
  const currentIds = new Set(rows.map((row) => row.id));
  if ([...atMountIds].some((id) => !currentIds.has(id))) {
    setAtMountIds(new Set([...atMountIds].filter((id) => currentIds.has(id))));
  }

  return (
    <MotionConfig reducedMotion="user">
      <AnimatePresence>
        {rows.map((row, index) => {
          const atMount = atMountIds.has(row.id);

          return (
            <motion.div
              key={row.id}
              style={{ overflow: "hidden" }}
              initial={atMount ? false : { height: 0 }}
              animate={{ height: "auto" }}
              exit={{
                height: 0,
                transition: { duration: 0.25, delay: 0.1, ease: "easeIn" },
              }}
            >
              <motion.div
                layout
                style={{ paddingBottom: "var(--space-3)" }}
                initial={
                  atMount ? { opacity: 0, y: 10 } : { opacity: 0, scale: 0.97 }
                }
                animate={{
                  opacity: 1,
                  y: 0,
                  scale: 1,
                  transition: {
                    duration: 0.2,
                    ease: "easeOut",
                    // Stagger the initial list; a row expanding into an
                    // existing list waits for its slot to open instead.
                    delay: atMount ? Math.min(index * 0.05, 0.4) : 0.15,
                  },
                }}
                exit={{
                  opacity: 0,
                  scale: 0.97,
                  transition: { duration: 0.2, ease: "easeIn" },
                }}
              >
                {row.node}
              </motion.div>
            </motion.div>
          );
        })}
      </AnimatePresence>
    </MotionConfig>
  );
}
