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
 * Same two modes as FollowStar: uncontrolled against a server prop with a
 * revalidate, or controlled by a parent whose rows live in client state.
 *
 * Lives inside a row that is itself a link; the click must not bubble into a
 * navigation.
 */
export function SeenEye({
  movieId,
  seen,
  revalidate,
  onToggle,
}: {
  movieId: number;
  seen: boolean;
  /** Uncontrolled mode: the path the action revalidates. */
  revalidate?: string;
  /** Controlled mode: the parent flips the state and calls the server. */
  onToggle?: (next: boolean) => void;
}) {
  const [optimisticSeen, setOptimisticSeen] = useOptimistic(seen);
  const [, startTransition] = useTransition();

  const shown = onToggle ? seen : optimisticSeen;

  return (
    <IconButton
      variant="ghost"
      color={shown ? "amber" : "gray"}
      aria-label={shown ? "Mark as not seen" : "Mark as seen"}
      aria-pressed={shown}
      onClick={(e) => {
        e.preventDefault();
        e.stopPropagation();
        const next = !shown;
        if (onToggle) {
          onToggle(next);
          return;
        }
        startTransition(async () => {
          setOptimisticSeen(next);
          if (next) await markSeen("movie", movieId, revalidate);
          else await unmarkSeen("movie", movieId, revalidate);
        });
      }}
    >
      {shown ? <EyeOpenIcon /> : <EyeNoneIcon />}
    </IconButton>
  );
}
