import type { CookieOptions } from "@supabase/ssr";

/**
 * Options for the Supabase auth cookies, shared by the server client and
 * the session-refreshing middleware so they never disagree.
 *
 * httpOnly: the cookie holds the refresh token, and nothing in the browser
 * needs it (the browser never talks to Supabase), so page scripts shouldn't
 * be able to read it. Any XSS would otherwise mean lasting account takeover.
 *
 * Not `secure`: a self-hosted instance served over plain http on a LAN would
 * never get its session back. On stubs.tv, Cloudflare's HTTPS redirect and
 * HSTS keep the cookie off plain http anyway.
 */
export const AUTH_COOKIE_OPTIONS: CookieOptions = { httpOnly: true };
