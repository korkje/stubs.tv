/**
 * Mirrors minimum_password_length in supabase/config.toml. The hosted
 * project can be stricter, and that is only discovered when GoTrue refuses
 * the password.
 */
export const MIN_PASSWORD_LENGTH = 6;

/**
 * A password nobody knows, for sign-ups whose real password is chosen from
 * the confirmation mail (ADR-0025). GoTrue requires one at sign-up; this one
 * is never shown or stored, and the confirmation step replaces it.
 */
export function throwawayPassword(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(32));
  return btoa(String.fromCharCode(...bytes));
}
