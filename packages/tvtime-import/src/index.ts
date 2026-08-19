// @stubs/tvtime-import — pure TV Time export parser (ADR-0015).
//
// No DOM, no network, no Supabase: the entry point takes filenames mapped to
// their text content and returns the normalised payload plus a report of
// what was read, ignored and skipped. It runs identically in the browser
// (fed by the client-side unzipper) and in Node (fed by test fixtures).
// Unzipping and password handling live in the client component, NOT here —
// keeping zip.js out of this module graph keeps it out of the worker bundle,
// which imports the payload types from this package.

import { GDPR_FILE_ALLOWLIST, parseGdprCsv } from "./gdpr";
import { looksLikeLiberator, parseLiberatorJson } from "./liberator";
import { UnrecognisedExportError, type ParseResult } from "./types";

export { GDPR_FILE_ALLOWLIST } from "./gdpr";
export { UnrecognisedExportError } from "./types";
export type {
  ImportPayload,
  ImportSource,
  ImportedMovie,
  ImportedShow,
  ImportedWatch,
  ParseReport,
  ParseResult,
  SkippedRow,
} from "./types";

/** ZIP entries carry paths; the export's CSVs are matched by basename. */
function basename(path: string): string {
  const parts = path.split("/");
  return parts[parts.length - 1].toLowerCase();
}

/**
 * Parse a TV Time export from `{ filename: content }`. Detects the format:
 * GDPR CSVs win when any recognised file is present; otherwise a JSON file
 * in the Liberator shape is accepted. Anything else throws
 * `UnrecognisedExportError` — importing nothing must never look like
 * success, because some 2025-era exports were JSON-only and unsupported.
 */
export function parseTvTimeExport(files: Record<string, string>): ParseResult {
  const byName = new Map<string, string>();
  for (const [path, content] of Object.entries(files)) {
    byName.set(basename(path), content);
  }

  const recognised = new Map<string, string>();
  for (const name of GDPR_FILE_ALLOWLIST) {
    const content = byName.get(name);
    if (content !== undefined) recognised.set(name, content);
  }
  if (recognised.size > 0) {
    const result = parseGdprCsv(recognised);
    if (result.report.filesUsed.length > 0) return result;
    // Recognised names but nothing parseable inside them: fall through to
    // the error rather than reporting an empty success.
  }

  for (const [name, content] of byName) {
    if (!name.endsWith(".json")) continue;
    let json: unknown;
    try {
      json = JSON.parse(content);
    } catch {
      continue;
    }
    if (looksLikeLiberator(json)) return parseLiberatorJson(json);
  }

  throw new UnrecognisedExportError(Object.keys(files));
}
