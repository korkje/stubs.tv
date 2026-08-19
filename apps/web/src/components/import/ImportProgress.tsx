"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Card, Flex, Heading, Progress, Text } from "@radix-ui/themes";
import { getImportStatus } from "@/lib/import/actions";
import type { ImportStatus } from "@/lib/import/types";

/**
 * Live view of an open import job. Polls the status action while the job is
 * queued/running — the worker updates counts as each series lands — and
 * hands back to the server-rendered summary with one router.refresh() when
 * the job finishes. Polling reads only; it must never revalidate the route
 * it lives on (the revalidatePath hazard in lib/tracking/actions.ts).
 */
export function ImportProgress({ initial }: { initial: ImportStatus }) {
  const router = useRouter();
  const [status, setStatus] = useState(initial);
  const doneRef = useRef(false);

  useEffect(() => {
    if (status.status !== "queued" && status.status !== "running") return;
    const timer = setInterval(async () => {
      try {
        const next = await getImportStatus();
        if (!next || next.jobId !== status.jobId) return;
        setStatus(next);
        if (next.status === "done" && !doneRef.current) {
          doneRef.current = true;
          router.refresh();
        }
      } catch {
        // Transient poll failures just wait for the next tick.
      }
    }, 3000);
    return () => clearInterval(timer);
  }, [status.status, status.jobId, router]);

  const { counts } = status;
  const value =
    counts.seriesTotal > 0
      ? Math.round((counts.seriesDone / counts.seriesTotal) * 100)
      : 100;

  return (
    <Card>
      <Flex direction="column" gap="3" p="2">
        <Heading size="4">
          {status.status === "done" ? "Import finished" : "Importing…"}
        </Heading>
        <Progress value={value} size="3" />
        <Text size="2" color="gray">
          {counts.seriesDone} of {counts.seriesTotal} shows ingested ·{" "}
          {status.episodesMatched} episodes placed
          {status.episodesUnmatched > 0 &&
            ` · ${status.episodesUnmatched} could not be placed`}
          {counts.movies > 0 &&
            ` · ${status.moviesMatched} of ${counts.movies} films matched`}
        </Text>
        {status.status !== "done" && (
          <Text size="2" color="gray">
            You can close this page — the import keeps running and your
            followed shows arrive first.
          </Text>
        )}
      </Flex>
    </Card>
  );
}
