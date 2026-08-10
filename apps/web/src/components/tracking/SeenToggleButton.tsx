"use client";

import { useOptimistic, useTransition } from "react";
import { Button } from "@radix-ui/themes";
import { EyeNoneIcon, EyeOpenIcon } from "@radix-ui/react-icons";
import { markSeen, unmarkSeen } from "@/lib/tracking/actions";

/** Seen/unseen for a single film, where a button reads better than a checkbox. */
export function SeenToggleButton({
  entityId,
  seen,
  revalidate,
}: {
  entityId: number;
  seen: boolean;
  revalidate: string;
}) {
  const [optimisticSeen, setOptimisticSeen] = useOptimistic(seen);
  const [, startTransition] = useTransition();

  return (
    <Button
      variant={optimisticSeen ? "soft" : "solid"}
      color={optimisticSeen ? "gray" : undefined}
      onClick={() => {
        const next = !optimisticSeen;
        startTransition(async () => {
          setOptimisticSeen(next);
          if (next) await markSeen("movie", entityId, revalidate);
          else await unmarkSeen("movie", entityId, revalidate);
        });
      }}
    >
      {optimisticSeen ? <EyeOpenIcon /> : <EyeNoneIcon />}
      {optimisticSeen ? "Seen" : "Mark as seen"}
    </Button>
  );
}
