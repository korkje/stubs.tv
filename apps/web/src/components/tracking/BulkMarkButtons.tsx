"use client";

import { useTransition } from "react";
import { Button, Flex } from "@radix-ui/themes";
import { EyeNoneIcon, EyeOpenIcon } from "@radix-ui/react-icons";
import { markManySeen, unmarkManySeen } from "@/lib/tracking/actions";

/**
 * Marks or unmarks a group of episodes — a season, or a whole show (specials
 * included). Bulk marks record no date, since they are usually backfilled
 * history rather than something watched just now.
 *
 * The eye icon carries the "seen" sense, so labels stay short ("Mark show"
 * rather than "Mark whole show seen").
 *
 * Colour and icon always describe the current state — amber with an open eye
 * means "all seen" — while the label describes what clicking does. Colouring
 * by action instead would make amber mean "seen" on episode toggles and
 * "not seen" here.
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
          color="amber"
          loading={pending}
          onClick={() =>
            startTransition(() => unmarkManySeen(episodeIds, revalidate))
          }
        >
          <EyeOpenIcon />
          Unmark {label}
        </Button>
      ) : (
        <Button
          size={size}
          variant="soft"
          color="gray"
          loading={pending}
          onClick={() =>
            startTransition(() => markManySeen(episodeIds, revalidate))
          }
        >
          <EyeNoneIcon />
          Mark {label}
        </Button>
      )}
    </Flex>
  );
}
