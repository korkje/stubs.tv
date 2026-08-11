"use client";

import { Children, isValidElement, useState } from "react";
import { AnimatePresence, MotionConfig, motion } from "motion/react";

/**
 * List wrapper that animates rows in and out. Each row is two layers: an
 * outer div that owns the row's vertical space (including the list gap, so
 * it can collapse away smoothly) and an inner div that owns the content.
 * Removing a row fades the content out first, then closes the gap — the
 * sequencing is what keeps it from looking like the list snapping shut. On
 * the list's first mount the rows fade up with a small stagger instead;
 * rows added to an already-mounted list expand into place.
 *
 * It is a client component receiving server-rendered rows: AnimatePresence
 * keeps a departed child around just long enough to play the exit. Keys come
 * from the rows themselves, so they must be stable and data-derived (they
 * are: internal ids).
 */
export function AnimatedRows({ children }: { children: React.ReactNode }) {
  const rows = Children.toArray(children).filter(isValidElement);
  // The keys present when the list mounted, captured once: those rows get
  // the staggered entrance, rows arriving later expand into place instead.
  // Motion reads `initial` at each row's mount, so nothing restyles.
  const [initialKeys] = useState(() => new Set(rows.map((row) => row.key)));

  return (
    <MotionConfig reducedMotion="user">
      <AnimatePresence>
        {rows.map((row, index) => {
          const atMount = initialKeys.has(row.key);

          return (
            <motion.div
              key={row.key}
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
                {row}
              </motion.div>
            </motion.div>
          );
        })}
      </AnimatePresence>
    </MotionConfig>
  );
}
