"use client";

import { useOptimistic, useTransition } from "react";
import { IconButton } from "@radix-ui/themes";
import { StarFilledIcon, StarIcon } from "@radix-ui/react-icons";
import { setFollowing } from "@/lib/tracking/actions";

/**
 * The follow toggle on a library row: filled amber star = followed, the same
 * state language as FollowButton. Icon-only, so the action lives in the
 * aria-label instead of a visible label.
 *
 * Two modes, split on `onToggle`. Uncontrolled (search results): the server
 * prop is the truth, useOptimistic bridges the round trip, and the action
 * revalidates the surface. Controlled (the library list): the row lives in
 * client state, so the optimistic-against-server-prop pattern would snap
 * back — the parent owns the state and the server call, and this renders
 * whatever it is handed.
 *
 * The row itself is a link; the click must not bubble into a navigation.
 */
export function FollowStar({
  seriesId,
  following,
  revalidate,
  onToggle,
}: {
  seriesId: number;
  following: boolean;
  /** Uncontrolled mode: the path the action revalidates. */
  revalidate?: string;
  /** Controlled mode: the parent flips the state and calls the server. */
  onToggle?: (next: boolean) => void;
}) {
  const [optimisticFollowing, setOptimisticFollowing] = useOptimistic(following);
  const [, startTransition] = useTransition();

  const shown = onToggle ? following : optimisticFollowing;

  return (
    <IconButton
      variant="ghost"
      color={shown ? "amber" : "gray"}
      aria-label={shown ? "Unfollow" : "Follow"}
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
          setOptimisticFollowing(next);
          await setFollowing(seriesId, next, revalidate);
        });
      }}
    >
      {shown ? <StarFilledIcon /> : <StarIcon />}
    </IconButton>
  );
}
