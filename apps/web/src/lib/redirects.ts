/** Resolution base for safeNext: any origin that can never be a real host. */
const PLACEHOLDER_ORIGIN = "http://safe-next.invalid";

/**
 * Validates a user-supplied post-auth destination. Only same-origin paths
 * pass: absolute URLs and protocol-relative "//host" would turn the login
 * and confirmation flows into open redirects.
 *
 * Prefix checks alone can't decide that, because browsers normalise before
 * resolving: they drop tab, CR and LF and read "\" as "/", so "/\t/evil.com"
 * arrives as "//evil.com". The value is therefore parsed the way a browser
 * parses it, and what comes back is the normalised path that was checked,
 * never the raw input.
 */
export function safeNext(value: unknown): string | null {
  if (typeof value !== "string" || value.length > 2048) return null;
  // Real destinations need neither, so refuse them outright rather than
  // reason about how each consumer (Location header, <Link>, the client
  // router) normalises them.
  if (/[\u0000-\u001f\u007f\\]/.test(value)) return null;
  if (!value.startsWith("/") || value.startsWith("//")) return null;

  let url: URL;
  try {
    url = new URL(value, PLACEHOLDER_ORIGIN);
  } catch {
    return null;
  }
  if (url.origin !== PLACEHOLDER_ORIGIN) return null;

  const path = url.pathname + url.search + url.hash;
  // Dot segments can still collapse "/.//evil.com" into "//evil.com", and
  // percent-encoding can grow a path past the length cap on re-check.
  if (path.startsWith("//") || path.length > 2048) return null;
  return path;
}
