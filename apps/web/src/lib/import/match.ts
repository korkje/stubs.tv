// Title matching for films, shared by the worker's auto-accept pass and
// the manual-pick action: a wrong film in someone's history is worse than
// a missing one, so auto-acceptance demands a single exact-title candidate
// within a year — anything fuzzier goes to the manual pick UI.

/** Lowercase, strip diacritics and punctuation, collapse whitespace. */
export function normaliseTitle(title: string): string {
  return title
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim();
}

export function yearsClose(a: number | null, b: number | null): boolean {
  if (a === null || b === null) return false;
  return Math.abs(a - b) <= 1;
}
