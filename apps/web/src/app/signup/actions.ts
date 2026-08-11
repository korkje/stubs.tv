"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

/** Error redirects keep the invite code, so the field survives a retry. */
function fail(message: string, inviteCode: string): never {
  const params = new URLSearchParams({ error: message });
  if (inviteCode) params.set("invite", inviteCode);
  redirect(`/signup?${params}`);
}

export async function signup(formData: FormData) {
  const supabase = await createClient();
  const inviteCode = ((formData.get("invite") as string) ?? "").trim();

  // The auth.users trigger is the real gate, but its exception surfaces from
  // GoTrue as an unhelpful "Database error saving new user" — ask first so
  // the form can show a real message. A race between this check and the
  // signup is still caught by the trigger.
  const { data: gate } = await supabase.rpc("signup_gate", { p_code: inviteCode });
  if (gate === "closed") {
    fail("Signups are invite-only right now — enter an invite code to join.", inviteCode);
  }
  if (gate === "invalid") {
    fail("That invite is invalid or has already been used.", inviteCode);
  }

  const { data, error } = await supabase.auth.signUp({
    email: formData.get("email") as string,
    password: formData.get("password") as string,
    // Carried in the user metadata so the signup trigger can redeem it.
    options: inviteCode ? { data: { invite_code: inviteCode } } : undefined,
  });

  if (error) {
    fail(error.message, inviteCode);
  }

  // With email confirmation enabled (hosted default) there is no session
  // yet — the user must click the link we just sent them.
  if (!data.session) {
    redirect("/check-email");
  }

  revalidatePath("/", "layout");
  redirect("/app");
}
