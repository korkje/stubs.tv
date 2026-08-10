/** Minutes as a compact human duration: 3886 → "2d 16h 46m". */
export function formatRuntime(minutes: number): string {
  if (minutes <= 0) return "—";

  const days = Math.floor(minutes / (60 * 24));
  const hours = Math.floor((minutes % (60 * 24)) / 60);
  const mins = minutes % 60;

  const parts: string[] = [];
  if (days) parts.push(`${days}d`);
  if (hours) parts.push(`${hours}h`);
  if (mins) parts.push(`${mins}m`);

  return parts.join(" ");
}

// Spelled out rather than derived from a locale: `en-GB` abbreviates September
// to "Sept", which makes a column of dates wobble.
const MONTHS = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
];

/** ISO date to a fixed-width label: "2002-09-01" → "1 Sep 2002". */
export function formatDate(value: string | null): string {
  if (!value) return "—";

  const date = new Date(`${value}T00:00:00Z`);
  if (Number.isNaN(date.getTime())) return "—";

  return `${date.getUTCDate()} ${MONTHS[date.getUTCMonth()]} ${date.getUTCFullYear()}`;
}
