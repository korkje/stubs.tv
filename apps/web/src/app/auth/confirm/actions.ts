"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { confirmLinkType } from "@/lib/auth/email-links";
import { MIN_PASSWORD_LENGTH } from "@/lib/auth/password";
import { isVisitorRateLimited } from "@/lib/auth/rate-limit";
import { safeNext } from "@/lib/redirects";
import { createClient } from "@/lib/supabase/server";

const INVALID =
  "Verification link is invalid or has expired. Try signing up again.";

/**
 * Spends a confirmation, magic-link or email-change token and signs the
 * user in: the only place /auth/confirm touches it (ADR-0023). Server
 * actions refuse cross-origin posts, so this only ever runs after a click
 * on our own page, never because another site sent the browser here.
 *
 * A sign-up confirmation (`type=email`) also sets the password, right after
 * the token proves the mailbox (ADR-0025). Sign-up itself can't be trusted
 * with it: GoTrue keeps the first password an unconfirmed account was given,
 * so whoever registered the address first would otherwise keep a way in.
 */
export async function confirmEmailLink(formData: FormData) {
  const tokenHash = String(formData.get("token_hash") ?? "").trim();
  const type = confirmLinkType(formData.get("type"));
  const next = safeNext(formData.get("next"));
  const password = String(formData.get("password") ?? "");

  if (tokenHash && type) {
    // Checked before the token is spent, like the reset flow (ADR-0011):
    // the common retry must not cost the link.
    if (type === "email" && password.length < MIN_PASSWORD_LENGTH) {
      retry(tokenHash, type, next, "short");
    }

    const supabase = await createClient();
    const { error } = await supabase.auth.verifyOtp({
      type,
      token_hash: tokenHash,
    });
    if (!error) {
      if (type === "email") await setChosenPassword(supabase, password);
      revalidatePath("/", "layout");
      redirect(next ?? "/app");
    }
    // Refused before it reached GoTrue (ADR-0026), so the link still works.
    if (isVisitorRateLimited(error)) retry(tokenHash, type, next, "rate");
  }

  // Same landing as before the page existed: the login form, which offers
  // a way forward and keeps the destination for a retry.
  const params = new URLSearchParams({ error: INVALID });
  if (next) params.set("next", next);
  redirect(`/login?${params}`);
}

/** Back to the confirmation page with the link intact, for another go. */
function retry(
  tokenHash: string,
  type: string,
  next: string | null,
  error: "short" | "rate"
): never {
  const params = new URLSearchParams({ token_hash: tokenHash, type, error });
  if (next) params.set("next", next);
  redirect(`/auth/confirm?${params}`);
}

/**
 * Sets the password chosen on the confirmation page. The token is spent and
 * the user is signed in by now, so a refusal (a stricter hosted policy than
 * MIN_PASSWORD_LENGTH, say) can't send them back to a form. It lands them on
 * settings, where Set up emails a fresh link for choosing another.
 */
async function setChosenPassword(
  supabase: Awaited<ReturnType<typeof createClient>>,
  password: string
): Promise<void> {
  const { error } = await supabase.auth.updateUser({ password });
  if (error && error.code !== "same_password") {
    const params = new URLSearchParams({
      tab: "account",
      link_error: `Your email is confirmed and you're signed in, but that password wasn't accepted (${error.message}). Use Set up below to choose another.`,
    });
    redirect(`/app/settings?${params}`);
  }

  // As after a password reset (ADR-0020): keep the email identity true to
  // the password. Non-fatal, because the password is already set.
  const { error: identityError } = await supabase.rpc("ensure_email_identity");
  if (identityError) {
    console.error(
      `ensure_email_identity failed after sign-up confirmation: ${identityError.message}`
    );
  }
}
