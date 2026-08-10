"use client";

import { useOptimistic, useTransition } from "react";
import { IconButton } from "@radix-ui/themes";
import { EyeNoneIcon, EyeOpenIcon } from "@radix-ui/react-icons";
import { markSeen, unmarkSeen } from "@/lib/tracking/actions";

/**
 * Seen toggle for a single episode. The state flips immediately and only
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
    <IconButton
      size="1"
      variant="ghost"
      color={optimisticSeen ? "amber" : "gray"}
      aria-label={optimisticSeen ? `Mark ${label} as not seen` : `Mark ${label} as seen`}
      aria-pressed={optimisticSeen}
      onClick={() => {
        const next = !optimisticSeen;
        startTransition(async () => {
          setOptimisticSeen(next);
          if (next) await markSeen("episode", episodeId, revalidate);
          else await unmarkSeen("episode", episodeId, revalidate);
        });
      }}
    >
      {optimisticSeen ? <EyeOpenIcon /> : <EyeNoneIcon />}
    </IconButton>
  );
}
