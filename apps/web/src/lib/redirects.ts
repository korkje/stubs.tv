/**
 * Validates a user-supplied post-auth destination. Only same-origin paths
 * pass: absolute URLs and protocol-relative "//host" would turn the login
 * and confirmation flows into open redirects.
 */
export function safeNext(value: unknown): string | null {
  if (typeof value !== "string" || value.length > 2048) return null;
  // "/\" as well as "//": browsers normalize backslashes, so "/\evil.com"
  // is another spelling of a protocol-relative URL.
  if (!value.startsWith("/") || value.startsWith("//")) return null;
  if (value.startsWith("/\\")) return null;
  return value;
}
