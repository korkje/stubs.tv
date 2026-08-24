import "server-only";

/**
 * OAuth providers this deployment offers, read from AUTH_PROVIDERS
 * (comma-separated, e.g. "google,apple") at request time. Deliberately a
 * server-only runtime var rather than NEXT_PUBLIC_*: the pages that render
 * provider buttons are dynamic, so nothing needs the value at build time,
 * and self-hosters (ADR-0019 spirit) can turn providers on or off with a
 * config change instead of a rebuild. Unset means no buttons and a pure
 * password/email instance — zero console setup required.
 */
export const OAUTH_PROVIDER_LABELS = {
  google: "Google",
  apple: "Apple",
} as const;

export type OAuthProvider = keyof typeof OAUTH_PROVIDER_LABELS;

export function isOAuthProvider(value: unknown): value is OAuthProvider {
  return typeof value === "string" && value in OAUTH_PROVIDER_LABELS;
}

export function enabledProviders(): OAuthProvider[] {
  return (process.env.AUTH_PROVIDERS ?? "")
    .split(",")
    .map((entry) => entry.trim().toLowerCase())
    .filter(isOAuthProvider);
}
