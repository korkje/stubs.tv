"use client";

import { useOptimistic, useTransition } from "react";
import { Checkbox } from "@radix-ui/themes";
import { markSeen, unmarkSeen } from "@/lib/tracking/actions";

/**
 * Seen checkbox for a single episode. The state flips immediately and only
 * reconciles when the server responds — this page can have hundreds of these,
 * and waiting a round trip per click would make ticking off a season painful.
 */
export function EpisodeToggle({
  episodeId,
  seen,
  revalidate,
  label,
}: {
  episodeId: number;
  seen: boolean;
  revalidate: string;
  label: string;
}) {
  const [optimisticSeen, setOptimisticSeen] = useOptimistic(seen);
  const [, startTransition] = useTransition();

  return (
    <Checkbox
      checked={optimisticSeen}
      aria-label={`Mark ${label} as seen`}
      onCheckedChange={(checked) => {
        const next = checked === true;
        startTransition(async () => {
          setOptimisticSeen(next);
          if (next) await markSeen("episode", episodeId, revalidate);
          else await unmarkSeen("episode", episodeId, revalidate);
        });
      }}
    />
  );
}
