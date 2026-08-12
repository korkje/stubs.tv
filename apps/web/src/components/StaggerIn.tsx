"use client";

import { Children } from "react";
import { MotionConfig, motion } from "motion/react";

/**
 * Fades children up one after another on mount — the same entrance the
 * library lists use, for content that has no exits to manage (episode rows
 * live and die with their season's collapse). The per-row delay is capped so
 * long lists don't take forever to finish.
 */
export function StaggerIn({ children }: { children: React.ReactNode }) {
  return (
    <MotionConfig reducedMotion="user">
      {Children.toArray(children).map((child, index) => (
        <motion.div
          key={index}
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{
            duration: 0.2,
            ease: "easeOut",
            delay: Math.min(index * 0.03, 0.4),
          }}
        >
          {child}
        </motion.div>
      ))}
    </MotionConfig>
  );
}
