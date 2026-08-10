"use client";

import { useOptimistic, useTransition } from "react";
import { Button } from "@radix-ui/themes";
import { setFollowing } from "@/lib/tracking/actions";

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
      variant={optimisticFollowing ? "soft" : "solid"}
      color={optimisticFollowing ? "gray" : undefined}
      onClick={() => {
        const next = !optimisticFollowing;
        startTransition(async () => {
          setOptimisticFollowing(next);
          await setFollowing(seriesId, next, revalidate);
        });
      }}
    >
      {optimisticFollowing ? "Following" : "Follow"}
    </Button>
  );
}
