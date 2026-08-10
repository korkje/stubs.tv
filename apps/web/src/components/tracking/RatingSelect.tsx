"use client";

import { useOptimistic, useTransition } from "react";
import { Select } from "@radix-ui/themes";
import { setRating } from "@/lib/tracking/actions";

const NOT_RATED = "none";

/**
 * A 1–10 score. Numeric rather than stars so there is real signal to build
 * recommendations on later; a rating is independent of whether the title is
 * marked as seen.
 */
export function RatingSelect({
  entityType,
  entityId,
  score,
  revalidate,
}: {
  entityType: "series" | "season" | "episode" | "movie";
  entityId: number;
  score: number | null;
  revalidate: string;
}) {
  const [optimisticScore, setOptimisticScore] = useOptimistic(score);
  const [, startTransition] = useTransition();

  return (
    <Select.Root
      value={optimisticScore === null ? NOT_RATED : String(optimisticScore)}
      onValueChange={(value) => {
        const next = value === NOT_RATED ? null : Number(value);
        startTransition(async () => {
          setOptimisticScore(next);
          await setRating(entityType, entityId, next, revalidate);
        });
      }}
    >
      <Select.Trigger variant="soft" color="gray" aria-label="Your rating" />
      <Select.Content position="popper">
        <Select.Item value={NOT_RATED}>Rate…</Select.Item>
        {Array.from({ length: 10 }, (_, index) => 10 - index).map((value) => (
          <Select.Item key={value} value={String(value)}>
            {value} / 10
          </Select.Item>
        ))}
      </Select.Content>
    </Select.Root>
  );
}
