"use client";

import { useTransition } from "react";
import { Button, Flex } from "@radix-ui/themes";
import { markManySeen, unmarkManySeen } from "@/lib/tracking/actions";

/**
 * "Mark all" / "Unmark all" for a group of episodes — a season, or a whole
 * show (specials included). Bulk marks record no date, since they are usually
 * backfilled history rather than something watched just now.
 */
export function BulkMarkButtons({
  episodeIds,
  revalidate,
  allSeen,
  size = "1",
  label = "all",
}: {
  episodeIds: number[];
  revalidate: string;
  allSeen: boolean;
  size?: "1" | "2";
  label?: string;
}) {
  const [pending, startTransition] = useTransition();

  return (
    <Flex gap="2">
      {allSeen ? (
        <Button
          size={size}
          variant="soft"
          color="gray"
          loading={pending}
          onClick={() =>
            startTransition(() => unmarkManySeen(episodeIds, revalidate))
          }
        >
          Unmark {label}
        </Button>
      ) : (
        <Button
          size={size}
          variant="soft"
          loading={pending}
          onClick={() =>
            startTransition(() => markManySeen(episodeIds, revalidate))
          }
        >
          Mark {label} seen
        </Button>
      )}
    </Flex>
  );
}
