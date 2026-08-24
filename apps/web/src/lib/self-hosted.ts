import "server-only";

/**
 * Self-hosted mode (ADR-0019): SELF_HOSTED=true removes the paywall.
 * Every signed-in account gets write access regardless of plan, and the
 * pricing/billing surfaces disappear (plans page, landing pricing,
 * read-only banner, settings billing tab, /checkout and /billing routes).
 *
 * An explicit flag rather than "no Polar config" on purpose: on a
 * commercial deploy a missing POLAR_ACCESS_TOKEN should surface as a loud
 * checkout failure, not silently unlock the product for free.
 */
export function isSelfHosted(): boolean {
  return process.env.SELF_HOSTED === "true";
}
