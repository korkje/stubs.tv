"use client";

import { useEffect, useState } from "react";
import { Flex, Text } from "@radix-ui/themes";
import { MotionConfig } from "motion/react";
import { AnimateNumber } from "motion-plus/react";

/**
 * A Stat whose figure counts up from zero on arrival. The unit structure
 * (days/hours/minutes) is fixed by the final value — "0h 0m" rolls to
 * "18h 22m" — so nothing appears or shifts mid-count; AnimateNumber handles
 * the digit transitions.
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
    <Flex direction="column">
      <Text size="1" color="gray">
        {label}
      </Text>
      <Text size="4" weight="medium">
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
