/**
 * The origin the browser actually used, for absolute redirects and callback
 * URLs built inside route handlers.
 *
 * On Workers `request.url` already carries it. The standalone Node server
 * (ADR-0021) does not: there `request.url` holds the listen address,
 * `http://0.0.0.0:3000`, so a redirect built from it points at nowhere.
 * Middleware is unaffected (`nextUrl` follows the Host header), so this
 * mirrors what it sees — the reverse proxy's forwarded headers first, then
 * Host, then `request.url` as the last resort. Convention: route handlers
 * build absolute URLs from this, never from `request.url`'s origin.
 */
export function requestOrigin(request: Request): string {
  const headers = request.headers;
  const host =
    headers.get("x-forwarded-host")?.split(",")[0].trim() ||
    headers.get("host");
  if (!host) return new URL(request.url).origin;

  const forwardedProto = headers.get("x-forwarded-proto")?.split(",")[0].trim();
  const proto =
    forwardedProto ||
    (/^(localhost|127\.|0\.0\.0\.0|\[::1\])/.test(host)
      ? "http"
      : new URL(request.url).protocol.slice(0, -1));
  return `${proto}://${host}`;
}
