"use client";

import { useEffect, useState } from "react";
import { Flex, Text } from "@radix-ui/themes";
import NumberFlow, { NumberFlowGroup } from "@number-flow/react";

/**
 * An animated watch-time figure ("108d 19h 12m"). NumberFlow handles the
 * digit transitions (chosen over Motion+'s AnimateNumber because it is MIT
 * off plain npm — the paid registry was the one thing a self-hoster
 * couldn't install, see docs/plans/going-public.md — and the two looked
 * near-identical side by side). The Group keeps the units' spins in
 * lockstep; the unit letters are styled down via ::part(suffix) in
 * globals.css. Reduced motion is respected by default.
 *
 * With `arrive` (the default) the figure counts up from zero on mount —
 * the unit structure is fixed by the final value, so nothing appears or
 * shifts mid-count. Either way, a later change to `minutes` rolls the
 * digits from where they stand: surfaces that revalidate (the series page)
 * or adjust client-side (the library totals) animate for free.
 */
export function TimeFigure({
  minutes,
  arrive = true,
}: {
  minutes: number;
  arrive?: boolean;
}) {
  const [arrived, setArrived] = useState(!arrive);
  // The count starts after the first paint: render zeros, then set the real
  // value one frame later. setState lives in the rAF callback, not the
  // effect body, so the first frame is guaranteed and the lint stays green.
  useEffect(() => {
    if (arrived) return;
    const id = requestAnimationFrame(() => setArrived(true));
    return () => cancelAnimationFrame(id);
  }, [arrived]);

  const days = Math.floor(minutes / (60 * 24));
  const hours = Math.floor((minutes % (60 * 24)) / 60);
  const mins = minutes % 60;
  const parts = [
    { value: days, suffix: "d" },
    { value: hours, suffix: "h" },
    { value: mins, suffix: "m" },
  ].filter((part) => part.value > 0);

  if (parts.length === 0) return <>—</>;

  return (
    <NumberFlowGroup>
      <span className="time-stat" style={{ whiteSpace: "nowrap" }}>
        {parts.map((part, index) => (
          <span key={part.suffix}>
            {index > 0 && " "}
            <NumberFlow
              value={arrived ? part.value : 0}
              suffix={part.suffix}
            />
          </span>
        ))}
      </span>
    </NumberFlowGroup>
  );
}

/**
 * A labelled TimeFigure for the library's totals row.
 *
 * Below the xs breakpoint the stat is a row (label left, figure right) rather
 * than a stack: a third of a phone's width is ~99px and a three-unit figure
 * ("108d 19h 12m") needs ~104px at this size, so the grid cell can never hold
 * it — the full row can, with ~200px to spare against a four-digit-day worst
 * case. The figure itself never wraps; if space runs out it must be a layout
 * bug, not a ragged second line of stray minutes.
 */
export function TimeStat({ label, minutes }: { label: string; minutes: number }) {
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
        <TimeFigure minutes={minutes} />
      </Text>
    </Flex>
  );
}
