"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { captchaToken, isCaptchaFailure } from "@/lib/auth/captcha";

/**
 * Sends the recovery email. The reply is deliberately the same whether or not
 * the address has an account: an endpoint that answers differently is a way
 * to enumerate who has one. Supabase already treats an unknown address as a
 * success, so there is nothing to suppress — only errors to swallow.
 *
 * Except a failed CAPTCHA (ADR-0024): that says nothing about the address,
 * and swallowing it would promise an email that was never sent.
 */
export async function requestPasswordReset(formData: FormData) {
  const supabase = await createClient();
  const email = ((formData.get("email") as string) ?? "").trim();

  if (email) {
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      captchaToken: captchaToken(formData),
    });
    if (isCaptchaFailure(error)) redirect("/forgot-password?error=captcha");
  }

  redirect("/check-email?flow=reset");
}
