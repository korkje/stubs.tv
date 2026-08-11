"use client";

import { useOptimistic, useTransition } from "react";
import { IconButton } from "@radix-ui/themes";
import { EyeNoneIcon, EyeOpenIcon } from "@radix-ui/react-icons";
import { markSeen, unmarkSeen } from "@/lib/tracking/actions";

/**
 * Icon-only seen toggle for a film, for rows where a labelled button would
 * crowd the line: amber open eye = seen, matching SeenToggleButton and the
 * episode toggles.
 *
 * Lives inside a row that is itself a link; the click must not bubble into a
 * navigation.
 */
export function SeenEye({
  movieId,
  seen,
  revalidate,
}: {
  movieId: number;
  seen: boolean;
  revalidate: string;
}) {
  const [optimisticSeen, setOptimisticSeen] = useOptimistic(seen);
  const [, startTransition] = useTransition();

  return (
    <IconButton
      variant="ghost"
      color={optimisticSeen ? "amber" : "gray"}
      aria-label={optimisticSeen ? "Mark as not seen" : "Mark as seen"}
      aria-pressed={optimisticSeen}
      onClick={(e) => {
        e.preventDefault();
        e.stopPropagation();
        const next = !optimisticSeen;
        startTransition(async () => {
          setOptimisticSeen(next);
          if (next) await markSeen("movie", movieId, revalidate);
          else await unmarkSeen("movie", movieId, revalidate);
        });
      }}
    >
      {optimisticSeen ? <EyeOpenIcon /> : <EyeNoneIcon />}
    </IconButton>
  );
}
