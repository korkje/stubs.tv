"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { safeNext } from "@/lib/redirects";

/** Error redirects keep the destination, so a retry still lands right. */
function fail(message: string, next: string | null): never {
  const params = new URLSearchParams({ error: message });
  if (next) params.set("next", next);
  redirect(`/signup?${params}`);
}

export async function signup(formData: FormData) {
  const supabase = await createClient();
  const next = safeNext(formData.get("next"));

  const { data, error } = await supabase.auth.signUp({
    email: formData.get("email") as string,
    password: formData.get("password") as string,
  });

  if (error) {
    fail(error.message, next);
  }

  // With email confirmation enabled (hosted default) there is no session
  // yet — the user must click the link we just sent them. The destination
  // does not survive the email round-trip; a fresh account lands on /app,
  // where the read-only banner points at the plans page anyway.
  if (!data.session) {
    redirect("/check-email");
  }

  revalidatePath("/", "layout");
  redirect(next ?? "/app");
}
