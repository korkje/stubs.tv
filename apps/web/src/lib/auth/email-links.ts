import type { EmailOtpType } from "@supabase/supabase-js";

/**
 * The link types /auth/confirm accepts: exactly the ones supabase/templates
 * sends there (sign-up confirmation, magic link, email change). Recovery has
 * its own page, which asks for the new password before spending the token
 * (ADR-0011); spent here, it would sign the user in without ever asking.
 */
const CONFIRM_LINK_TYPES = [
  "email",
  "magiclink",
  "email_change",
] as const satisfies readonly EmailOtpType[];

export type ConfirmLinkType = (typeof CONFIRM_LINK_TYPES)[number];

export function confirmLinkType(value: unknown): ConfirmLinkType | null {
  return CONFIRM_LINK_TYPES.find((type) => type === value) ?? null;
}
