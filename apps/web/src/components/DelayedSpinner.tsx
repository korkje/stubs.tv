"use client";

import { Flex, Spinner } from "@radix-ui/themes";
import { MotionConfig, motion } from "motion/react";

/**
 * Pending state that keeps quiet unless the wait is real: the spinner fades
 * in only after 300ms, so fast responses swap straight to content with no
 * intermediate state flashing by.
 *
 * This is the one marker for "the content is not here yet" — route-level
 * loading, the library's list, the search results — so `data-pending` is
 * what globals.css keys the footer's attribution off. It marks the wait, not
 * the spinner: the first 300ms of every wait are spent with this mounted and
 * nothing yet drawn, and the footer has to stay away for those too.
 */
export function DelayedSpinner() {
  return (
    <MotionConfig reducedMotion="user">
      <motion.div
        data-pending
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.3, duration: 0.2, ease: "easeOut" }}
      >
        <Flex justify="center" py="8">
          <Spinner size="3" />
        </Flex>
      </motion.div>
    </MotionConfig>
  );
}
