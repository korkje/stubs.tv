import type { Metadata } from "next";
import {
  Callout,
  Container,
  Flex,
  Heading,
  Separator,
  Table,
  Text,
} from "@radix-ui/themes";
import { CheckCircledIcon } from "@radix-ui/react-icons";
import type { ParseReport } from "@stubs/tvtime-import";
import { createClient } from "@/lib/supabase/server";
import { getImportStatus } from "@/lib/import/actions";
import { FadeIn } from "@/components/FadeIn";
import { ImportProgress } from "@/components/import/ImportProgress";
import { MovieResolver } from "@/components/import/MovieResolver";
import { TvTimeImporter } from "@/components/import/TvTimeImporter";

export const metadata: Metadata = {
  title: "Import — stubs.tv",
};

/**
 * The import surface: drop a TV Time export, preview it (parsed in the
 * browser, ADR-0015), commit, watch the job land, then read the honest
 * accounting — imported vs TV Time's own counts, films needing a manual
 * pick, and what was skipped. Re-running an import is safe by design
 * (everything upserts), so the importer stays available below a finished
 * job's summary.
 */
export default async function ImportPage() {
  const status = await getImportStatus();
  const open = status?.status === "queued" || status?.status === "running";
  const done = status?.status === "done";

  return (
    <Container size="3" px="4">
      <FadeIn>
      <Flex direction="column" gap="5">
        <Heading size="6">Import your watch history</Heading>

        {status && (open || done) && <ImportProgress initial={status} />}

        {done && <ImportSummary jobId={status.jobId} />}

        {!open && (
          <>
            {done && (
              <>
                <Separator size="4" />
                <Heading size="4">Import again</Heading>
                <Text size="2" color="gray">
                  Re-running an import is safe: nothing is double-counted, and
                  episodes you have marked here keep their dates.
                </Text>
              </>
            )}
            <TvTimeImporter mode="app" />
          </>
        )}
      </Flex>
      </FadeIn>
    </Container>
  );
}

/**
 * The reconciliation report (plan §6): per show, what landed vs what
 * TV Time itself counted. Every prior importer found gaps — deleted shows,
 * renumbered episodes, specials counted differently — and surfacing a small
 * shortfall builds more trust than a silent claim of completeness.
 */
async function ImportSummary({ jobId }: { jobId: number }) {
  const supabase = await createClient();

  const [{ data: job, error: jobError }, { data: rows, error: rowsError }, { data: unmatchedMovies, error: moviesError }] =
    await Promise.all([
      supabase
        .from("import_jobs")
        .select("reported, report, counts")
        .eq("id", jobId)
        .single(),
      supabase
        .from("import_reconciliation")
        .select("tvdb_series_id, series_name, matched, unmatched, pending")
        .eq("job_id", jobId),
      supabase
        .from("import_movie_intents")
        .select("id, name, year")
        .eq("job_id", jobId)
        .eq("status", "unmatched")
        .order("name"),
    ]);
  if (jobError) throw new Error(`Could not load the import: ${jobError.message}`);
  if (rowsError) throw new Error(`Could not load the reconciliation: ${rowsError.message}`);
  if (moviesError) throw new Error(`Could not load the unmatched films: ${moviesError.message}`);

  const reported = (job?.reported ?? {}) as Record<string, number>;
  const report = (job?.report ?? {}) as Partial<ParseReport>;
  const skipped = report.skipped ?? [];

  const shortfalls = (rows ?? [])
    .map((row) => {
      const claimed = reported[String(row.tvdb_series_id)] ?? null;
      const matched = row.matched ?? 0;
      const unmatched = row.unmatched ?? 0;
      return {
        name: row.series_name,
        matched,
        unmatched,
        claimed,
        shortfall: Math.max(
          claimed !== null ? claimed - matched : 0,
          unmatched
        ),
      };
    })
    .filter((row) => row.shortfall > 0)
    .sort((a, b) => b.shortfall - a.shortfall)
    .slice(0, 15);

  return (
    <Flex direction="column" gap="4">
      {unmatchedMovies && unmatchedMovies.length > 0 && (
        <MovieResolver movies={unmatchedMovies} />
      )}

      {shortfalls.length === 0 ? (
        <Callout.Root color="green">
          <Callout.Icon>
            <CheckCircledIcon />
          </Callout.Icon>
          <Callout.Text>
            Every show reconciled against TV Time&apos;s own episode counts.
          </Callout.Text>
        </Callout.Root>
      ) : (
        <Flex direction="column" gap="2">
          <Heading size="4">Where counts differ</Heading>
          <Text size="2" color="gray">
            TV Time&apos;s export carries its own per-show seen counter; where
            we placed fewer episodes, the gap is listed here rather than
            hidden. Usual causes: TheTVDB renumbered a season since you
            watched it, or the episodes no longer exist under those numbers.
          </Text>
          <Table.Root size="1">
            <Table.Header>
              <Table.Row>
                <Table.ColumnHeaderCell>Show</Table.ColumnHeaderCell>
                <Table.ColumnHeaderCell>Imported</Table.ColumnHeaderCell>
                <Table.ColumnHeaderCell>TV Time counted</Table.ColumnHeaderCell>
                <Table.ColumnHeaderCell>Unplaced</Table.ColumnHeaderCell>
              </Table.Row>
            </Table.Header>
            <Table.Body>
              {shortfalls.map((row) => (
                <Table.Row key={row.name}>
                  <Table.Cell>{row.name}</Table.Cell>
                  <Table.Cell>{row.matched}</Table.Cell>
                  <Table.Cell>{row.claimed ?? "—"}</Table.Cell>
                  <Table.Cell>{row.unmatched || "—"}</Table.Cell>
                </Table.Row>
              ))}
            </Table.Body>
          </Table.Root>
        </Flex>
      )}

      <Flex direction="column" gap="1">
        {skipped.length > 0 && (
          <Text size="2" color="gray">
            {skipped.length} rows in the export could not be read (
            {[...new Set(skipped.map((s) => s.reason))].slice(0, 3).join("; ")}
            {new Set(skipped.map((s) => s.reason)).size > 3 ? "; …" : ""}).
          </Text>
        )}
        <Text size="2" color="gray">
          Watch dates are TV Time&apos;s check-in times — seasons marked in
          bulk there share one timestamp, so old history can look clustered.
        </Text>
        <Text size="2" color="gray">
          Not imported, because they have no home here yet: lists and
          favourites, comments, emoji reactions, and the to-watch film list.
        </Text>
      </Flex>
    </Flex>
  );
}
