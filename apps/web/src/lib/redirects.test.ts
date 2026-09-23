import { describe, expect, it } from "vitest";
import { safeNext } from "./redirects";

const SITE = "https://stubs.tv";

/**
 * Whether a destination leaves the site in any of its consumers: a Location
 * header or <Link> resolves it against the current page, and Next's client
 * router then resolves that result's pathname + search + hash once more.
 */
function leavesSite(next: string): boolean {
  try {
    const first = new URL(next, `${SITE}/login?next=x`);
    if (first.origin !== SITE) return true;
    const again = new URL(first.pathname + first.search + first.hash, SITE);
    return again.origin !== SITE;
  } catch {
    return true;
  }
}

describe("safeNext", () => {
  it("keeps same-origin paths with their query and fragment", () => {
    expect(safeNext("/app")).toBe("/app");
    expect(safeNext("/app/settings?tab=account&linked=1")).toBe(
      "/app/settings?tab=account&linked=1"
    );
    expect(safeNext("/app/export#top")).toBe("/app/export#top");
  });

  it("rejects anything that is not an absolute path", () => {
    for (const value of [
      null,
      undefined,
      42,
      "",
      "app",
      "?next=/app",
      "https://evil.com",
      "javascript:alert(1)",
      `/${"a".repeat(2048)}`,
    ]) {
      expect(safeNext(value), JSON.stringify(value)).toBeNull();
    }
  });

  it("rejects every spelling of a protocol-relative URL", () => {
    for (const value of [
      "//evil.com",
      "/\\evil.com",
      // Browsers drop tab, CR and LF before parsing.
      "/\t/evil.com",
      "/\n/evil.com",
      "/\r/evil.com",
      "/\t\\evil.com",
      // Dot segments collapse into "//" once parsed.
      "/.//evil.com",
      "/..//evil.com",
      "/%2E//evil.com",
    ]) {
      expect(safeNext(value), JSON.stringify(value)).toBeNull();
    }
  });

  it("never returns a destination that leaves the site", () => {
    // Every combination of up to four pieces after the leading slash.
    const pieces = [
      "/", "\\", "\t", "\n", ".", "..", "%2F", "%5C",
      "%09", "%2E", "@", ":", "evil.com", "?", "#", " ",
    ];
    const values: string[] = [];
    let level = ["/"];
    for (let depth = 0; depth < 4; depth++) {
      level = level.flatMap((prefix) => pieces.map((piece) => prefix + piece));
      values.push(...level);
    }

    const failures = values.filter((value) => {
      const next = safeNext(value);
      // Destinations round-trip through hidden inputs and query strings, so
      // a second pass must leave them unchanged.
      return next !== null && (leavesSite(next) || safeNext(next) !== next);
    });
    expect(failures).toEqual([]);
  });
});
