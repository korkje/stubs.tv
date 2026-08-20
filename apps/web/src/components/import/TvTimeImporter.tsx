"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Badge,
  Box,
  Button,
  Callout,
  Card,
  Flex,
  Heading,
  Text,
  TextField,
} from "@radix-ui/themes";
import {
  CheckCircledIcon,
  ExclamationTriangleIcon,
  LockClosedIcon,
  UploadIcon,
} from "@radix-ui/react-icons";
import {
  parseTvTimeExport,
  UnrecognisedExportError,
  type ParseResult,
} from "@stubs/tvtime-import";
import { commitImport } from "@/lib/import/actions";
import { readArchive, WrongPasswordError } from "./readArchive";

/**
 * The whole import funnel in one component (ADR-0015): pick the export,
 * unzip and parse it in the browser, preview what it holds — free, even
 * logged out — and, in app mode, commit the normalised payload. The archive
 * itself never leaves the machine; only TVDB ids, numbers, timestamps and
 * film titles are posted.
 *
 * mode "public" renders on /import/tv-time for strangers: same preview,
 * with a signup CTA instead of a commit button.
 */
export function TvTimeImporter({ mode }: { mode: "public" | "app" }) {
  const router = useRouter();
  const [file, setFile] = useState<File | null>(null);
  const [password, setPassword] = useState("");
  const [parsing, setParsing] = useState(false);
  const [result, setResult] = useState<ParseResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [committing, startCommit] = useTransition();

  const parse = async () => {
    if (!file) return;
    setParsing(true);
    setError(null);
    setResult(null);
    try {
      const files = await readArchive(file, password);
      setResult(parseTvTimeExport(files));
    } catch (err) {
      if (err instanceof WrongPasswordError) {
        setError(
          "That password doesn't open this archive. TV Time emailed it separately from the download link."
        );
      } else if (err instanceof UnrecognisedExportError) {
        setError(
          "No watch history found in this file. Expected a TV Time GDPR export ZIP (CSV files inside) or a TV Time Liberator JSON. If your export is from before 2026 it may be an older format — nothing was imported."
        );
      } else {
        setError(
          err instanceof Error ? err.message : "Could not read that file."
        );
      }
    } finally {
      setParsing(false);
    }
  };

  const commit = () => {
    if (!result) return;
    startCommit(async () => {
      try {
        await commitImport(result.payload, result.report);
        // The server page takes over: progress, then the reconciliation.
        router.refresh();
      } catch (err) {
        setError(
          err instanceof Error ? err.message : "The import could not start."
        );
      }
    });
  };

  const summary = result ? summarise(result) : null;

  return (
    <Flex direction="column" gap="4">
      <Card>
        <Flex direction="column" gap="3" p="2">
          {/* The icon anchors to the first line rather than floating
              centered beside the paragraph: on phones the text wraps to
              four or five lines and a centered 15px default icon read as a
              stray speck. 20px matches size-2 text's 20px line height. */}
          <Flex align="start" gap="2">
            <LockClosedIcon width={20} height={20} style={{ flexShrink: 0 }} />
            <Text size="2" color="gray">
              Everything on this page happens in your browser. The ZIP and its
              password never leave your machine — only show ids, episode
              numbers, dates and film titles are sent if you import.
            </Text>
          </Flex>

          <label>
            <Text as="div" size="2" mb="1" weight="medium">
              Your TV Time export (.zip, or a Liberator .json)
            </Text>
            <input
              type="file"
              accept=".zip,.json,application/zip,application/json"
              onChange={(event) => {
                setFile(event.currentTarget.files?.[0] ?? null);
                setResult(null);
                setError(null);
              }}
            />
          </label>

          <label>
            <Text as="div" size="2" mb="1" weight="medium">
              Archive password
            </Text>
            {/* size 3 is 16px: anything smaller makes iOS Safari zoom in
                when the field is focused. */}
            <TextField.Root
              size="3"
              type="password"
              autoComplete="off"
              placeholder="From TV Time's second email"
              value={password}
              onChange={(event) => setPassword(event.currentTarget.value)}
            />
            <Text as="div" size="1" color="gray" mt="1">
              Not needed for a Liberator .json file.
            </Text>
          </label>

          <Box>
            <Button size="3" onClick={parse} disabled={!file} loading={parsing}>
              <UploadIcon /> Read the export
            </Button>
          </Box>
        </Flex>
      </Card>

      {error && (
        <Callout.Root color="red">
          <Callout.Icon>
            <ExclamationTriangleIcon />
          </Callout.Icon>
          <Callout.Text>{error}</Callout.Text>
        </Callout.Root>
      )}

      {result && summary && (
        <Card>
          <Flex direction="column" gap="3" p="2">
            <Heading size="4">Found in your export</Heading>
            <Flex gap="2" wrap="wrap">
              <Badge size="2" color="amber">
                {summary.shows} shows
              </Badge>
              <Badge size="2" color="amber">
                {summary.episodes} episodes watched
              </Badge>
              <Badge size="2" color="amber">
                {summary.movies} films watched
              </Badge>
              {summary.earliestYear && (
                <Badge size="2" color="gray">
                  back to {summary.earliestYear}
                </Badge>
              )}
            </Flex>
            <Text size="2" color="gray">
              {plural(summary.follows, "show")} will be followed (what TV Time
              had actively followed — finished and archived shows import their
              history without cluttering your feed)
              {summary.ratings > 0 &&
                `, and ${plural(summary.ratings, "show rating")} ${
                  summary.ratings === 1 ? "comes" : "come"
                } along`}
              .
            </Text>
            {summary.watchlisted > 0 && (
              <Text size="2" color="gray">
                {plural(summary.watchlisted, "film")} on your to-watch list{" "}
                {summary.watchlisted === 1 ? "is" : "are"} not imported — there
                is no watchlist here yet.
              </Text>
            )}
            {result.report.usedV1Fallback && (
              <Text size="2" color="gray">
                This export had no v2 tracking file, so the older episode
                records were used — counts can be slightly lower.
              </Text>
            )}
            {result.report.skipped.length > 0 && (
              <Text size="2" color="gray">
                {plural(result.report.skipped.length, "row")} could not be read
                and {result.report.skipped.length === 1 ? "was" : "were"}{" "}
                skipped; the import summary will list them.
              </Text>
            )}

            {mode === "app" ? (
              <Box>
                <Button size="3" onClick={commit} loading={committing}>
                  <CheckCircledIcon /> Import it all
                </Button>
              </Box>
            ) : (
              <Flex direction="column" gap="2">
                <Text size="2">
                  Ready when you are — create an account and this import runs
                  immediately. The annual plan&apos;s first month is free.
                </Text>
                <Box>
                  <Button size="3" asChild>
                    <Link href="/signup?next=/app/import">
                      Create an account to import
                    </Link>
                  </Button>
                </Box>
              </Flex>
            )}
          </Flex>
        </Card>
      )}
    </Flex>
  );
}

function plural(n: number, noun: string): string {
  return `${n} ${noun}${n === 1 ? "" : "s"}`;
}

function summarise(result: ParseResult) {
  const { payload } = result;
  const watched = payload.movies.filter((m) => !m.watchlisted);
  let earliest: string | null = null;
  for (const w of payload.watches) {
    if (w.watchedAt && (!earliest || w.watchedAt < earliest)) {
      earliest = w.watchedAt;
    }
  }
  for (const m of watched) {
    if (m.watchedAt && (!earliest || m.watchedAt < earliest)) {
      earliest = m.watchedAt;
    }
  }
  return {
    shows: new Set([
      ...payload.shows.map((s) => s.tvdb),
      ...payload.watches.map((w) => w.tvdb),
    ]).size,
    episodes: payload.watches.length,
    movies: watched.length,
    watchlisted: payload.movies.length - watched.length,
    follows: payload.shows.filter((s) => s.followed && !s.archived).length,
    ratings: payload.shows.filter((s) => s.rating !== null).length,
    earliestYear: earliest ? earliest.slice(0, 4) : null,
  };
}
