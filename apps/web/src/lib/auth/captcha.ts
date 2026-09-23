import "server-only";

/**
 * The Cloudflare Turnstile site key for the auth forms, or null when this
 * deployment runs without CAPTCHA (ADR-0024). A runtime var, read on dynamic
 * routes like AUTH_PROVIDERS, so no rebuild is needed to change it. It must
 * be set whenever CAPTCHA is enabled in Supabase, or every sign-in, sign-up
 * and password reset fails.
 */
export function turnstileSiteKey(): string | null {
  return process.env.TURNSTILE_SITE_KEY?.trim() || null;
}

/** The widget's token from a submitted form, for GoTrue's `captchaToken`. */
export function captchaToken(formData: FormData): string | undefined {
  const value = formData.get("captcha_token");
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

/** GoTrue's code for a missing, spent or rejected CAPTCHA token. */
export function isCaptchaFailure(
  error: { code?: string } | null | undefined
): boolean {
  return error?.code === "captcha_failed";
}

export const CAPTCHA_FAILED =
  "The check that you're not a bot didn't go through. Let it finish under the form, then try again.";
