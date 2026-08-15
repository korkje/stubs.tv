"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

/**
 * Sends the recovery email. The reply is deliberately the same whether or not
 * the address has an account: an endpoint that answers differently is a way to
 * find out who has one, and signups being invite-only makes that list more
 * interesting than usual. Supabase already treats an unknown address as a
 * success, so there is nothing to suppress — only errors to swallow.
 */
export async function requestPasswordReset(formData: FormData) {
  const supabase = await createClient();
  const email = ((formData.get("email") as string) ?? "").trim();

  if (email) {
    await supabase.auth.resetPasswordForEmail(email);
  }

  redirect("/check-email?flow=reset");
}
