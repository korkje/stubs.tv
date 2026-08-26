import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { parseTvTimeExport, UnrecognisedExportError } from "../src/index";
import { parseCsv } from "../src/csv";

const FIXTURES = join(import.meta.dirname, "fixtures");
const read = (name: string) => readFileSync(join(FIXTURES, name), "utf8");

function fullExport(): Record<string, string> {
  return {
    "followed_tv_show.csv": read("followed_tv_show.csv"),
    "tracking-prod-records-v2.csv": read("tracking-prod-records-v2.csv"),
    "tracking-prod-records.csv": read("tracking-prod-records.csv"),
    "user_tv_show_data.csv": read("user_tv_show_data.csv"),
    "tv_show_rate.csv": read("tv_show_rate.csv"),
  };
}

describe("csv", () => {
  it("handles quotes, embedded commas, embedded newlines and CRLF", () => {
    const { header, rows, malformed } = parseCsv(
      'a,b,c\r\n1,"x, y",plain\r\n2,"he said ""hi""","line\nbreak"\r\n'
    );
    expect(header).toEqual(["a", "b", "c"]);
    expect(rows).toHaveLength(2);
    expect(rows[0].cells).toEqual({ a: "1", b: "x, y", c: "plain" });
    expect(rows[1].cells).toEqual({
      a: "2",
      b: 'he said "hi"',
      c: "line\nbreak",
    });
    expect(malformed).toHaveLength(0);
  });

  it("reports malformed rows with their line number", () => {
    const { rows, malformed } = parseCsv("a,b\n1,2\nonly-one\n3,4");
    expect(rows).toHaveLength(2);
    expect(malformed).toEqual([{ line: 3, cellCount: 1, expected: 2 }]);
  });
});

describe("GDPR CSV export", () => {
  const { payload, report } = parseTvTimeExport(fullExport());

  it("identifies the source and the files it used", () => {
    expect(payload.source).toBe("tvtime-gdpr-csv");
    expect(report.filesUsed).toContain("tracking-prod-records-v2.csv");
    expect(report.usedV1Fallback).toBe(false);
  });

  it("collapses rewatches to the earliest watch and counts the extras", () => {
    const got = payload.watches.find(
      (w) => w.tvdb === 121361 && w.season === 1 && w.episode === 1
    );
    expect(got).toBeDefined();
    expect(got!.watchedAt).toBe("2019-01-01T10:00:00Z");
    expect(got!.rewatchCount).toBe(1);
  });

  it("keys on (series, season, episode) even when ep_id is empty", () => {
    expect(
      payload.watches.find(
        (w) => w.tvdb === 121361 && w.season === 1 && w.episode === 2
      )
    ).toBeDefined();
  });

  it("recovers series/season/episode from the key when columns are empty", () => {
    const st = payload.watches.find((w) => w.tvdb === 305288);
    expect(st).toMatchObject({ season: 1, episode: 1 });
    expect(st!.watchedAt).toBe("2019-07-04T21:00:00Z");
  });

  it("keeps specials (season 0) as ordinary watches", () => {
    expect(
      payload.watches.find(
        (w) => w.tvdb === 121361 && w.season === 0 && w.episode === 1
      )
    ).toBeDefined();
  });

  it("survives titles with commas and quotes", () => {
    const show = payload.shows.find((s) => s.tvdb === 343179);
    expect(show?.name).toBe('Love, Death & "Robots"');
  });

  it("unions follow state: followed_tv_show + user-series rows", () => {
    const got = payload.shows.find((s) => s.tvdb === 121361);
    expect(got).toMatchObject({ followed: true, archived: false });
    const stranger = payload.shows.find((s) => s.tvdb === 305288);
    expect(stranger).toMatchObject({ followed: true, archived: false });
  });

  it("marks archived shows so history imports without a follow", () => {
    const who = payload.shows.find((s) => s.tvdb === 78804);
    expect(who).toMatchObject({ followed: true, archived: true });
    expect(
      payload.watches.find((w) => w.tvdb === 78804)
    ).toBeDefined();
  });

  it("imports movies from created_at, converting runtime to minutes", () => {
    const inception = payload.movies.find((m) => m.name === "Inception");
    expect(inception).toMatchObject({
      year: 2010,
      runtimeMin: 148,
      watchlisted: false,
    });
    // Two watch rows exist; the earlier one wins.
    expect(inception!.watchedAt).toBe("2020-11-11T11:11:11Z");
  });

  it("treats 0001-01-01 release dates as unknown year", () => {
    const dune = payload.movies.find((m) => m.name === "Dune Part Three");
    expect(dune).toMatchObject({ year: null, watchlisted: true, watchedAt: null });
  });

  it("keeps movie titles with commas intact", () => {
    expect(
      payload.movies.find((m) => m.name === "The Good, the Bad and the Ugly")
    ).toBeDefined();
  });

  it("ignores aggregate rows silently but reports broken ones", () => {
    // Aggregates (count-*, time-count, …) are structure, not damage.
    expect(
      report.skipped.filter((s) => s.reason.includes("aggregate"))
    ).toHaveLength(0);
    // The keyless watch row and the title-less movie row are damage.
    expect(
      report.skipped.some((s) =>
        s.reason.includes("watch row without series id")
      )
    ).toBe(true);
    expect(
      report.skipped.some((s) => s.reason.includes("movie row without a title"))
    ).toBe(true);
    // The structurally malformed line is reported with its arity.
    expect(report.skipped.some((s) => s.reason.includes("malformed row"))).toBe(
      true
    );
  });

  it("collects TV Time's own per-show seen counts for reconciliation", () => {
    expect(payload.reported["121361"]).toBe(73);
    expect(payload.reported["78804"]).toBe(13);
  });

  it("imports 1-10 show ratings, dropping 0 silently and 11 loudly", () => {
    expect(payload.shows.find((s) => s.tvdb === 121361)?.rating).toBe(9);
    expect(payload.shows.find((s) => s.tvdb === 78804)?.rating).toBeNull();
    expect(payload.shows.find((s) => s.tvdb === 305288)?.rating).toBeNull();
    expect(
      report.skipped.some((s) => s.reason.includes("outside the 1-10 scale"))
    ).toBe(true);
  });
});

describe("v1 fallback", () => {
  it("reads episodes from tracking-prod-records.csv only when v2 is absent", () => {
    const { payload, report } = parseTvTimeExport({
      "tracking-prod-records.csv": read("tracking-prod-records.v1-only.csv"),
    });
    expect(report.usedV1Fallback).toBe(true);
    expect(payload.watches).toHaveLength(2);
    expect(payload.watches[0]).toMatchObject({ tvdb: 121361, season: 1 });
  });

  it("prefers v2 when both are present", () => {
    const { payload, report } = parseTvTimeExport({
      "tracking-prod-records-v2.csv": read("tracking-prod-records-v2.csv"),
      "tracking-prod-records.csv": read("tracking-prod-records.v1-only.csv"),
    });
    expect(report.usedV1Fallback).toBe(false);
    // The v1-only file's two extra GoT episode rows must not double in.
    const got11 = payload.watches.filter(
      (w) => w.tvdb === 121361 && w.season === 1 && w.episode === 1
    );
    expect(got11).toHaveLength(1);
  });
});

describe("Liberator JSON", () => {
  it("parses shows, movies-free exports and per-episode watches", () => {
    const { payload, report } = parseTvTimeExport({
      "liberator.json": read("liberator.json"),
    });
    expect(payload.source).toBe("tvtime-liberator-json");
    expect(payload.shows).toHaveLength(2);
    const eleven = payload.shows.find((s) => s.tvdb === 366529);
    // "stopped" maps to archive semantics: keep history, don't follow.
    expect(eleven).toMatchObject({ followed: false, archived: true, rating: 8 });
    expect(payload.watches).toHaveLength(2);
    expect(
      payload.watches.find((w) => w.tvdb === 366529)!.watchedAt
    ).toBe("2022-01-05T21:00:00Z");
    expect(report.filesUsed).toEqual(["liberator.json"]);
  });

  it("pins naive watched_at datetimes to UTC, not the machine's zone", () => {
    const { payload } = parseTvTimeExport({
      "liberator.json": JSON.stringify([
        {
          id: { tvdb: 366529 },
          title: "Station Eleven",
          status: "watching",
          seasons: [
            {
              number: 1,
              episodes: [
                {
                  id: { tvdb: 8815687 },
                  number: 1,
                  is_watched: true,
                  watched_at: "2022-01-05 21:00:00",
                },
              ],
            },
          ],
        },
      ]),
    });
    // Would be 2022-01-05T20:00:00Z (or worse) if parsed in a local zone.
    expect(payload.watches[0].watchedAt).toBe("2022-01-05T21:00:00Z");
  });
});

describe("unrecognised archives", () => {
  it("throws rather than importing nothing", () => {
    expect(() =>
      parseTvTimeExport({ "user.csv": "id,email\n1,a@b.c\n" })
    ).toThrow(UnrecognisedExportError);
  });

  it("throws on JSON that is not a Liberator export", () => {
    expect(() =>
      parseTvTimeExport({ "export.json": JSON.stringify({ hello: "world" }) })
    ).toThrow(UnrecognisedExportError);
  });

  it("matches files by basename so ZIP paths do not matter", () => {
    const files = Object.fromEntries(
      Object.entries(fullExport()).map(([k, v]) => [`export/data/${k}`, v])
    );
    expect(parseTvTimeExport(files).payload.shows.length).toBeGreaterThan(0);
  });
});
