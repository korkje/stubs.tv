"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { confirmLinkType } from "@/lib/auth/email-links";
import { safeNext } from "@/lib/redirects";
import { createClient } from "@/lib/supabase/server";

const INVALID =
  "Verification link is invalid or has expired. Try signing up again.";

/**
 * Spends a confirmation, magic-link or email-change token and signs the
 * user in: the only place /auth/confirm touches it (ADR-0023). Server
 * actions refuse cross-origin posts, so this only ever runs after a click
 * on our own page, never because another site sent the browser here.
 */
export async function confirmEmailLink(formData: FormData) {
  const tokenHash = String(formData.get("token_hash") ?? "").trim();
  const type = confirmLinkType(formData.get("type"));
  const next = safeNext(formData.get("next"));

  if (tokenHash && type) {
    const supabase = await createClient();
    const { error } = await supabase.auth.verifyOtp({
      type,
      token_hash: tokenHash,
    });
    if (!error) {
      revalidatePath("/", "layout");
      redirect(next ?? "/app");
    }
  }

  // Same landing as before the page existed: the login form, which offers
  // a way forward and keeps the destination for a retry.
  const params = new URLSearchParams({ error: INVALID });
  if (next) params.set("next", next);
  redirect(`/login?${params}`);
}
