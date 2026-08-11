"use client";

import { AnimatePresence, MotionConfig, motion } from "motion/react";

/**
 * Animated expand/collapse for server-driven content: pass children when
 * open and nothing when closed. The wrapper is a client component that
 * persists across server re-renders, so AnimatePresence can hold on to
 * dropped content long enough to play the collapse. Content that is already
 * open on first render (a season deep-linked in the URL) appears without
 * animating.
 */
export function Collapse({ children }: { children?: React.ReactNode }) {
  return (
    <MotionConfig reducedMotion="user">
      <AnimatePresence initial={false}>
        {children ? (
          <motion.div
            key="content"
            style={{ overflow: "hidden" }}
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.25, ease: "easeOut" }}
          >
            {children}
          </motion.div>
        ) : null}
      </AnimatePresence>
    </MotionConfig>
  );
}
