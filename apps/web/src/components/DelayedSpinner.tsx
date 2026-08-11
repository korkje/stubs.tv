"use client";

import { Flex, Spinner } from "@radix-ui/themes";
import { MotionConfig, motion } from "motion/react";

/**
 * Pending state that keeps quiet unless the wait is real: the spinner fades
 * in only after 300ms, so fast responses swap straight to content with no
 * intermediate state flashing by.
 */
export function DelayedSpinner() {
  return (
    <MotionConfig reducedMotion="user">
      <motion.div
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
