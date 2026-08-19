/**
 * Hand-rolled iCalendar (RFC 5545) serializer for the episode feed —
 * deliberately no dependency: the format is a handful of text rules and the
 * bundle budget is real (docs/plans/ical-feed.md).
 *
 * The rules that matter, because clients silently drop malformed events:
 * - TEXT values escape backslash, semicolon, comma and newlines.
 * - Content lines fold at 75 octets (bytes, not characters — folding must
 *   never split a UTF-8 sequence), continuation lines start with a space.
 * - Line endings are CRLF, including after the last line.
 * - UIDs must be stable across polls or clients duplicate events.
 * - DTSTAMP is required by some clients on every VEVENT.
 */

export type CalendarEpisode = {
  episode_id: number;
  series_id: number;
  series_name: string;
  season_number: number;
  episode_number: number;
  episode_name: string | null;
  overview: string | null;
  aired: string; // YYYY-MM-DD
};

/** RFC 5545 §3.3.11 TEXT escaping. */
function escapeText(value: string): string {
  return value
    .replace(/\\/g, "\\\\")
    .replace(/;/g, "\\;")
    .replace(/,/g, "\\,")
    .replace(/\r\n|\r|\n/g, "\\n");
}

const encoder = new TextEncoder();

/**
 * Folds one content line at 75 octets. Counts bytes so multibyte characters
 * are never split; continuation lines carry the leading space inside their
 * own 75-octet budget.
 */
function foldLine(line: string): string {
  if (encoder.encode(line).length <= 75) return line;

  const out: string[] = [];
  let current = "";
  for (const char of line) {
    const size = encoder.encode(char).length;
    if (encoder.encode(current).length + size > 75) {
      out.push(current);
      current = " " + char;
    } else {
      current += char;
    }
  }
  out.push(current);
  return out.join("\r\n");
}

/** 20260820 for a YYYY-MM-DD date, day offset applied in UTC. */
function icsDate(isoDate: string, addDays = 0): string {
  const [y, m, d] = isoDate.split("-").map(Number);
  const date = new Date(Date.UTC(y, m - 1, d + addDays));
  return date.toISOString().slice(0, 10).replace(/-/g, "");
}

/** 20260820T101500Z */
function icsTimestamp(date: Date): string {
  return date.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
}

/**
 * Builds the whole calendar. Events are all-day on the air date — episode
 * air *times* are not in the data model, and an all-day entry matches how
 * people think about "comes out today" anyway.
 */
export function buildCalendar(options: {
  episodes: CalendarEpisode[];
  origin: string;
  now: Date;
}): string {
  const { episodes, origin, now } = options;
  const dtstamp = icsTimestamp(now);

  const lines: string[] = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//stubs.tv//EN",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    "X-WR-CALNAME:stubs.tv",
    // Hints only — clients poll on their own schedule regardless.
    "REFRESH-INTERVAL;VALUE=DURATION:PT12H",
    "X-PUBLISHED-TTL:PT12H",
  ];

  for (const ep of episodes) {
    const numbering = `${ep.season_number}×${String(
      ep.episode_number
    ).padStart(2, "0")}`;
    const summary = ep.episode_name
      ? `${ep.series_name} ${numbering} — ${ep.episode_name}`
      : `${ep.series_name} ${numbering}`;

    lines.push(
      "BEGIN:VEVENT",
      `UID:episode-${ep.episode_id}@stubs.tv`,
      `DTSTAMP:${dtstamp}`,
      `DTSTART;VALUE=DATE:${icsDate(ep.aired)}`,
      `DTEND;VALUE=DATE:${icsDate(ep.aired, 1)}`,
      `SUMMARY:${escapeText(summary)}`
    );
    if (ep.overview) {
      lines.push(`DESCRIPTION:${escapeText(ep.overview)}`);
    }
    lines.push(`URL:${origin}/app/series/${ep.series_id}`, "END:VEVENT");
  }

  lines.push("END:VCALENDAR");
  return lines.map(foldLine).join("\r\n") + "\r\n";
}
