"use client";

import { MotionConfig, motion } from "motion/react";

/**
 * Gentle entrance for page content: fade up over a quarter second, so a page
 * arriving after the route spinner (or a slow ingestion) settles in instead
 * of popping. Client-side param changes on an already-mounted page keep the
 * same instance, so this plays on real arrivals only, not on every tab or
 * query switch.
 */
export function FadeIn({ children }: { children: React.ReactNode }) {
  return (
    <MotionConfig reducedMotion="user">
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.25, ease: "easeOut" }}
      >
        {children}
      </motion.div>
    </MotionConfig>
  );
}
