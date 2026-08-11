"use client";

import { Children, isValidElement } from "react";
import { AnimatePresence, MotionConfig, motion } from "motion/react";

/**
 * List wrapper that animates rows out when they leave — e.g. unfollowing a
 * show or unseeing a movie drops it from the list on the next server render,
 * and this turns that pop into a slide-and-settle.
 *
 * It is a client component receiving server-rendered rows: AnimatePresence
 * keeps the departed child around just long enough to play the exit, and
 * `layout` glides the remaining rows into place. Keys come from the rows
 * themselves, so they must be stable and data-derived (they are: internal
 * ids). Entrances are deliberately not animated — lists should just be there
 * on arrival.
 */
export function AnimatedRows({ children }: { children: React.ReactNode }) {
  const rows = Children.toArray(children).filter(isValidElement);

  return (
    <MotionConfig reducedMotion="user">
      <AnimatePresence initial={false}>
        {rows.map((row) => (
          <motion.div
            key={row.key}
            layout
            exit={{ opacity: 0, x: -24 }}
            transition={{ duration: 0.2, ease: "easeOut" }}
          >
            {row}
          </motion.div>
        ))}
      </AnimatePresence>
    </MotionConfig>
  );
}
