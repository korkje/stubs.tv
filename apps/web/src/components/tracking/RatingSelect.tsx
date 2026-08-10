"use client";

import { useOptimistic, useTransition } from "react";
import { Select } from "@radix-ui/themes";
import { setRating } from "@/lib/tracking/actions";

const CLEAR = "clear";

/**
 * A 1–10 score. Numeric rather than stars so there is real signal to build
 * recommendations on later; a rating is independent of whether the title is
 * marked as seen.
 *
 * "No rating" is the empty string rather than a sentinel item, because the
 * trigger can only render an item's label once the dropdown has been opened —
 * a sentinel would show an unlabelled button until then.
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
      value={optimisticScore === null ? "" : String(optimisticScore)}
      onValueChange={(value) => {
        const next = value === CLEAR ? null : Number(value);
        startTransition(async () => {
          setOptimisticScore(next);
          await setRating(entityType, entityId, next, revalidate);
        });
      }}
    >
      <Select.Trigger
        variant="soft"
        color="gray"
        placeholder="Rate…"
        aria-label="Your rating"
      />
      <Select.Content position="popper">
        {Array.from({ length: 10 }, (_, index) => 10 - index).map((value) => (
          <Select.Item key={value} value={String(value)}>
            {value} / 10
          </Select.Item>
        ))}
        {optimisticScore !== null && (
          <>
            <Select.Separator />
            <Select.Item value={CLEAR}>Clear rating</Select.Item>
          </>
        )}
      </Select.Content>
    </Select.Root>
  );
}
