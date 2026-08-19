"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  Box,
  Button,
  Card,
  Flex,
  Heading,
  Inset,
  Text,
} from "@radix-ui/themes";
import {
  resolveMovieIntent,
  searchMovieCandidates,
  skipMovieIntent,
} from "@/lib/import/actions";
import type { MovieCandidate } from "@/lib/import/types";

interface UnmatchedMovie {
  id: number;
  name: string;
  year: number | null;
}

/**
 * The manual tail of the film import. The GDPR export carries no ids for
 * films, so anything the worker couldn't match on an exact title + year
 * lands here: a few candidates with posters, click the right one or skip.
 * A wrong film in someone's history is worse than a missing one, which is
 * why nothing fuzzy was auto-accepted on their behalf.
 */
export function MovieResolver({ movies }: { movies: UnmatchedMovie[] }) {
  const router = useRouter();
  const [open, setOpen] = useState<number | null>(null);
  const [candidates, setCandidates] = useState<MovieCandidate[]>([]);
  const [resolvedIds, setResolvedIds] = useState<Set<number>>(new Set());
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const remaining = movies.filter((m) => !resolvedIds.has(m.id));
  if (remaining.length === 0) return null;

  const find = (movie: UnmatchedMovie) => {
    setError(null);
    setOpen(movie.id);
    setCandidates([]);
    startTransition(async () => {
      try {
        setCandidates(await searchMovieCandidates(movie.id));
      } catch (err) {
        setError(err instanceof Error ? err.message : "Search failed.");
      }
    });
  };

  const settle = (movieId: number, action: () => Promise<void>) => {
    setError(null);
    startTransition(async () => {
      try {
        await action();
        setResolvedIds((previous) => new Set(previous).add(movieId));
        setOpen(null);
        router.refresh();
      } catch (err) {
        setError(err instanceof Error ? err.message : "That didn't work.");
      }
    });
  };

  return (
    <Card>
      <Flex direction="column" gap="3" p="2">
        <Heading size="4">Films that need a look</Heading>
        <Text size="2" color="gray">
          TV Time stored films by title only —{" "}
          {remaining.length === 1
            ? "this one had"
            : `these ${remaining.length} had`}{" "}
          no single exact match, so pick the right one or skip it. Nothing is
          guessed on your behalf.
        </Text>
        {error && (
          <Text size="2" color="red">
            {error}
          </Text>
        )}
        <Flex direction="column" gap="2">
          {remaining.map((movie) => (
            <Box key={movie.id}>
              <Flex align="center" gap="3" wrap="wrap">
                <Text size="2" weight="medium">
                  {movie.name}
                  {movie.year !== null && (
                    <Text size="2" color="gray">
                      {" "}
                      ({movie.year})
                    </Text>
                  )}
                </Text>
                <Button
                  size="1"
                  variant="soft"
                  disabled={pending}
                  onClick={() => find(movie)}
                >
                  Find matches
                </Button>
                <Button
                  size="1"
                  variant="ghost"
                  color="gray"
                  disabled={pending}
                  onClick={() =>
                    settle(movie.id, () => skipMovieIntent(movie.id))
                  }
                >
                  Skip
                </Button>
              </Flex>
              {open === movie.id && (
                <Flex gap="3" mt="2" wrap="wrap">
                  {pending && candidates.length === 0 ? (
                    <Text size="2" color="gray">
                      Searching…
                    </Text>
                  ) : candidates.length === 0 ? (
                    <Text size="2" color="gray">
                      No films found under that title.
                    </Text>
                  ) : (
                    candidates.map((candidate) => (
                      <Card
                        key={candidate.providerId}
                        asChild
                        style={{ width: 120, cursor: "pointer" }}
                      >
                        <button
                          type="button"
                          disabled={pending}
                          onClick={() =>
                            settle(movie.id, () =>
                              resolveMovieIntent(
                                movie.id,
                                candidate.providerId,
                                candidate.name
                              )
                            )
                          }
                        >
                          <Flex direction="column" gap="1">
                            {candidate.posterUrl && (
                              <Inset side="top" mb="1">
                                {/* Poster thumbnails; next/image is
                                    unoptimized here anyway (ADR-0002). */}
                                {/* eslint-disable-next-line @next/next/no-img-element */}
                                <img
                                  src={candidate.posterUrl}
                                  alt=""
                                  style={{
                                    width: "100%",
                                    aspectRatio: "2 / 3",
                                    objectFit: "cover",
                                  }}
                                />
                              </Inset>
                            )}
                            <Text size="1" weight="medium">
                              {candidate.name}
                            </Text>
                            {candidate.year !== null && (
                              <Text size="1" color="gray">
                                {candidate.year}
                              </Text>
                            )}
                          </Flex>
                        </button>
                      </Card>
                    ))
                  )}
                </Flex>
              )}
            </Box>
          ))}
        </Flex>
      </Flex>
    </Card>
  );
}
