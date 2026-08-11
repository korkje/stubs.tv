"use client";

import { Children, isValidElement, useState } from "react";
import { AnimatePresence, MotionConfig, motion } from "motion/react";

/**
 * List wrapper that animates rows in and out. Each row is two layers: an
 * outer div that owns the row's vertical space (including the list gap, so
 * it can collapse away smoothly) and an inner div that owns the content.
 * Removing a row fades the content out first, then closes the gap — the
 * sequencing is what keeps it from looking like the list snapping shut. On
 * the list's first mount the rows quickly fade in place — they are usually
 * replacing skeletons of the same shape — and rows added to an
 * already-mounted list expand into place.
 *
 * It is a client component receiving server-rendered rows: AnimatePresence
 * keeps a departed child around just long enough to play the exit. Keys come
 * from the rows themselves, so they must be stable and data-derived (they
 * are: internal ids).
 */
export function AnimatedRows({ children }: { children: React.ReactNode }) {
  const rows = Children.toArray(children).filter(isValidElement);
  // The keys present when the list mounted, captured once: those rows fade
  // in place of the skeletons, rows arriving later expand into place.
  // Motion reads `initial` at each row's mount, so nothing restyles.
  const [initialKeys] = useState(() => new Set(rows.map((row) => row.key)));

  return (
    <MotionConfig reducedMotion="user">
      <AnimatePresence>
        {rows.map((row) => {
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
                // At-mount rows usually replace skeletons of the same shape,
                // so they resolve in place with a plain quick fade — a
                // staggered entrance on top of a skeleton reads as loading
                // twice. Rows added later expand into their slot instead.
                initial={atMount ? { opacity: 0 } : { opacity: 0, scale: 0.97 }}
                animate={{
                  opacity: 1,
                  scale: 1,
                  transition: {
                    duration: atMount ? 0.15 : 0.2,
                    ease: "easeOut",
                    delay: atMount ? 0 : 0.15,
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
