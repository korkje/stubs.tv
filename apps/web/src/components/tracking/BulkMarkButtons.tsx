"use client";

import { useTransition } from "react";
import { Button } from "@radix-ui/themes";
import { EyeNoneIcon, EyeOpenIcon } from "@radix-ui/react-icons";
import { markEpisodesSeen, unmarkEpisodesSeen } from "@/lib/tracking/actions";

/**
 * Marks or unmarks a season, or the whole show when seasonNumber is null
 * (specials included). Only the two identifiers cross the wire — the database
 * decides which episodes that means, and skips unaired ones.
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
  seriesId,
  seasonNumber = null,
  revalidate,
  allSeen,
  size = "1",
  label = "all",
}: {
  seriesId: number;
  seasonNumber?: number | null;
  revalidate: string;
  allSeen: boolean;
  size?: "1" | "2";
  label?: string;
}) {
  const [pending, startTransition] = useTransition();

  const run = (action: typeof markEpisodesSeen) => () =>
    startTransition(() => action(seriesId, seasonNumber, revalidate));

  return allSeen ? (
    <Button
      size={size}
      variant="soft"
      color="amber"
      loading={pending}
      onClick={run(unmarkEpisodesSeen)}
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
      onClick={run(markEpisodesSeen)}
    >
      <EyeNoneIcon />
      Mark {label}
    </Button>
  );
}
