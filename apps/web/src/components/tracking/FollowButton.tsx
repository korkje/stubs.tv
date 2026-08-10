"use client";

import { useOptimistic, useTransition } from "react";
import { Button } from "@radix-ui/themes";
import { StarFilledIcon, StarIcon } from "@radix-ui/react-icons";
import { setFollowing } from "@/lib/tracking/actions";

/**
 * Follow toggle for a show.
 *
 * Follows the same rule as the seen controls: colour and icon describe the
 * current state (amber, filled = followed), the label describes what clicking
 * does. That keeps one meaning for amber across the app rather than having it
 * mean "seen" on one control and "not yet actioned" on another.
 */
export function FollowButton({
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
    <Button
      variant="soft"
      color={optimisticFollowing ? "amber" : "gray"}
      onClick={() => {
        const next = !optimisticFollowing;
        startTransition(async () => {
          setOptimisticFollowing(next);
          await setFollowing(seriesId, next, revalidate);
        });
      }}
    >
      {optimisticFollowing ? <StarFilledIcon /> : <StarIcon />}
      {optimisticFollowing ? "Unfollow" : "Follow"}
    </Button>
  );
}
