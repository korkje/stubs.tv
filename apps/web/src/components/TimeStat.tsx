"use client";

import { useEffect, useState } from "react";
import { Flex, Text } from "@radix-ui/themes";
import { MotionConfig } from "motion/react";
import { AnimateNumber } from "@motionplus/core/react";

/**
 * A Stat whose figure counts up from zero on arrival. The unit structure
 * (days/hours/minutes) is fixed by the final value — "0h 0m" rolls to
 * "18h 22m" — so nothing appears or shifts mid-count; AnimateNumber handles
 * the digit transitions.
 *
 * Below the xs breakpoint the stat is a row (label left, figure right) rather
 * than a stack: a third of a phone's width is ~99px and a three-unit figure
 * ("108d 19h 12m") needs ~104px at this size, so the grid cell can never hold
 * it — the full row can, with ~200px to spare against a four-digit-day worst
 * case. The figure itself never wraps; if space runs out it must be a layout
 * bug, not a ragged second line of stray minutes.
 */
export function TimeStat({ label, minutes }: { label: string; minutes: number }) {
  // The count starts after the first paint: render zeros, then set the real
  // value one frame later. setState lives in the rAF callback, not the
  // effect body, so the first frame is guaranteed and the lint stays green.
  const [arrived, setArrived] = useState(false);
  useEffect(() => {
    const id = requestAnimationFrame(() => setArrived(true));
    return () => cancelAnimationFrame(id);
  }, []);

  const days = Math.floor(minutes / (60 * 24));
  const hours = Math.floor((minutes % (60 * 24)) / 60);
  const mins = minutes % 60;
  const parts = [
    { value: days, suffix: "d" },
    { value: hours, suffix: "h" },
    { value: mins, suffix: "m" },
  ].filter((part) => part.value > 0);

  return (
    <Flex
      direction={{ initial: "row", xs: "column" }}
      justify={{ initial: "between", xs: "start" }}
      align={{ initial: "baseline", xs: "stretch" }}
    >
      <Text size="1" color="gray">
        {label}
      </Text>
      <Text size="4" weight="medium" style={{ whiteSpace: "nowrap" }}>
        {parts.length === 0 ? (
          "—"
        ) : (
          <MotionConfig reducedMotion="user">
            {parts.map((part, index) => (
              <span key={part.suffix}>
                {index > 0 && " "}
                <AnimateNumber
                  suffix={part.suffix}
                  transition={{ duration: 0.8, ease: "easeOut" }}
                >
                  {arrived ? part.value : 0}
                </AnimateNumber>
              </span>
            ))}
          </MotionConfig>
        )}
      </Text>
    </Flex>
  );
}
