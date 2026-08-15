"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

/** Mirrors minimum_password_length in supabase/config.toml. */
const MIN_LENGTH = 6;

const EXPIRED =
  "That reset link is invalid or has expired. Request a new one.";

/**
 * Error redirects carry the token back only while it is still worth
 * retrying with. Once it has been spent there is nothing to retry, so the
 * form drops away and the page offers a fresh link instead.
 */
function fail(message: string, tokenHash: string): never {
  const params = new URLSearchParams({ error: message });
  if (tokenHash) params.set("token_hash", tokenHash);
  redirect(`/auth/reset-password?${params}`);
}

/**
 * Sets a new password from a recovery link.
 *
 * The token is spent here rather than by /auth/confirm on the way in, so the
 * link only ever lands on the form: a mail client that prefetches links
 * cannot burn the token before the user clicks it.
 *
 * A valid token is the only way through. Falling back to whatever session
 * happens to exist would be friendlier on a retry, but it would also let a
 * stolen cookie set a new password without the old one — which is exactly
 * what changePassword refuses to allow — and, on a shared browser, would
 * quietly change the signed-in account's password when the link belonged to
 * someone else.
 */
export async function resetPassword(formData: FormData) {
  const supabase = await createClient();
  const tokenHash = ((formData.get("token_hash") as string) ?? "").trim();
  const password = (formData.get("password") as string) ?? "";

  if (!tokenHash) {
    fail(EXPIRED, "");
  }

  // Checked before the token is spent: the one retry worth keeping cheap.
  if (password.length < MIN_LENGTH) {
    fail(`Password must be at least ${MIN_LENGTH} characters.`, tokenHash);
  }

  const { error: invalidToken } = await supabase.auth.verifyOtp({
    type: "recovery",
    token_hash: tokenHash,
  });

  if (invalidToken) {
    fail(EXPIRED, "");
  }

  const { error } = await supabase.auth.updateUser({ password });

  if (error) {
    // Nothing to change, and verifyOtp has already signed them in — sending
    // them back to a form whose token is now spent would strand them over a
    // password they already have.
    if (error.code !== "same_password") {
      fail(error.message, "");
    }
  }

  // verifyOtp signed the user in, so they land in the app already.
  revalidatePath("/", "layout");
  redirect("/app");
}
