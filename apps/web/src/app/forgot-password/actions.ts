"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { captchaToken, isCaptchaFailure } from "@/lib/auth/captcha";
import { isVisitorRateLimited } from "@/lib/auth/rate-limit";

/**
 * Sends the recovery email. The reply is deliberately the same whether or not
 * the address has an account: an endpoint that answers differently is a way
 * to enumerate who has one. Supabase already treats an unknown address as a
 * success, so there is nothing to suppress — only errors to swallow.
 *
 * Except a failed CAPTCHA (ADR-0024) or the visitor's own rate limit
 * (ADR-0026). Neither says anything about the address, and swallowing them
 * would promise an email that was never sent. GoTrue's own rate limits stay
 * swallowed: its per-address limit only trips for an address that has an
 * account.
 */
export async function requestPasswordReset(formData: FormData) {
  const supabase = await createClient();
  const email = ((formData.get("email") as string) ?? "").trim();

  if (email) {
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      captchaToken: captchaToken(formData),
    });
    if (isCaptchaFailure(error)) redirect("/forgot-password?error=captcha");
    if (isVisitorRateLimited(error)) redirect("/forgot-password?error=rate");
  }

  redirect("/check-email?flow=reset");
}
