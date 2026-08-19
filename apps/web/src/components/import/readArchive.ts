// Client-side archive reading (ADR-0015). The export ZIP carries the user's
// password hash, live auth tokens, IP history and device data alongside the
// watch history — so only the allow-listed watch-history filenames are ever
// decompressed, and nothing here runs anywhere but the user's browser.
// zip.js loads on demand (first file selected) to keep it off every other
// route; it handles both ZipCrypto and AES, which real TV Time ZIPs used.

import { GDPR_FILE_ALLOWLIST } from "@stubs/tvtime-import";

export class WrongPasswordError extends Error {
  constructor() {
    super("That password doesn't open this archive.");
    this.name = "WrongPasswordError";
  }
}

export async function readArchive(
  file: File,
  password: string
): Promise<Record<string, string>> {
  // A bare .json file is the Liberator export — the user's deliberate,
  // credential-free file. Everything else is treated as a ZIP.
  if (file.name.toLowerCase().endsWith(".json")) {
    return { [file.name]: await file.text() };
  }

  const zip = await import("@zip.js/zip.js");
  const reader = new zip.ZipReader(new zip.BlobReader(file), {
    password: password || undefined,
  });

  const files: Record<string, string> = {};
  try {
    const allow = new Set<string>(GDPR_FILE_ALLOWLIST);
    const entries = await reader.getEntries();
    for (const entry of entries) {
      if (entry.directory || !entry.getData) continue;
      const base = entry.filename.split("/").pop()?.toLowerCase() ?? "";
      // Names outside the allow-list still surface in the "nothing
      // recognised" error, so record them — content stays sealed.
      if (!allow.has(base)) {
        files[entry.filename] ??= "";
        continue;
      }
      try {
        files[entry.filename] = await entry.getData(new zip.TextWriter());
      } catch (error) {
        if (
          error instanceof Error &&
          (error.message === zip.ERR_INVALID_PASSWORD ||
            error.message === zip.ERR_ENCRYPTED)
        ) {
          throw new WrongPasswordError();
        }
        throw error;
      }
    }
  } finally {
    await reader.close();
  }
  return files;
}
