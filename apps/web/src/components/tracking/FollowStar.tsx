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
 * The row itself is a link; the click must not bubble into a navigation.
 */
export function FollowStar({
  seriesId,
  following,
  revalidate,
}: {
  seriesId: number;
  following: boolean;
  revalidate: string;
}) {
  const [optimisticFollowing, setOptimisticFollowing] = useOptimistic(following);
  const [, startTransition] = useTransition();

  return (
    <IconButton
      variant="ghost"
      color={optimisticFollowing ? "amber" : "gray"}
      aria-label={optimisticFollowing ? "Unfollow" : "Follow"}
      aria-pressed={optimisticFollowing}
      onClick={(e) => {
        e.preventDefault();
        e.stopPropagation();
        const next = !optimisticFollowing;
        startTransition(async () => {
          setOptimisticFollowing(next);
          await setFollowing(seriesId, next, revalidate);
        });
      }}
    >
      {optimisticFollowing ? <StarFilledIcon /> : <StarIcon />}
    </IconButton>
  );
}
