"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

const SPECIALS = new Set(["hidden", "uncounted", "counted"]);
const SYNOPSES = new Set(["show", "scramble", "hide"]);

/**
 * Saves the settings form. RLS restricts the update to the caller's own row
 * and the column grant to exactly these columns; the checks here just turn
 * a tampered form into a friendly error instead of a constraint violation.
 */
export async function updateSettings(formData: FormData) {
  const supabase = await createClient();

  const displayName = ((formData.get("display_name") as string) ?? "").trim();
  const timezone = ((formData.get("timezone") as string) ?? "").trim();
  const specials = (formData.get("specials") as string) ?? "uncounted";
  const synopsisMode = (formData.get("synopsis_mode") as string) ?? "show";
  const bulkMarkSpecials = formData.get("bulk_mark_specials") === "on";

  if (!SPECIALS.has(specials) || !SYNOPSES.has(synopsisMode)) {
    redirect(`/app/settings?error=${encodeURIComponent("Invalid settings values.")}`);
  }
  if (timezone) {
    try {
      new Intl.DateTimeFormat("en", { timeZone: timezone });
    } catch {
      redirect(`/app/settings?error=${encodeURIComponent("Unknown timezone.")}`);
    }
  }

  const { error } = await supabase
    .from("profiles")
    .update({
      display_name: displayName || null,
      timezone: timezone || null,
      specials,
      synopsis_mode: synopsisMode,
      bulk_mark_specials: bulkMarkSpecials,
    })
    .eq("user_id", (await supabase.auth.getUser()).data.user?.id ?? "");

  if (error) {
    redirect(`/app/settings?error=${encodeURIComponent(error.message)}`);
  }

  // Settings shape what most pages show.
  revalidatePath("/", "layout");
  redirect("/app/settings?saved=1");
}

/** Mirrors minimum_password_length in supabase/config.toml. */
const MIN_PASSWORD_LENGTH = 6;

function failPassword(message: string): never {
  redirect(`/app/settings?password_error=${encodeURIComponent(message)}`);
}

/**
 * Changes the password of the signed-in user.
 *
 * The current password is checked by signing in with it rather than trusted
 * from the session: a session on its own is not proof the person at the
 * keyboard is the owner, and a password change is what locks the real owner
 * out. Supabase's own secure_password_change setting only asks for a recent
 * login, which a stolen session satisfies, so it is not a substitute for
 * this. The reset flow refuses sessions entirely for the same reason — see
 * app/auth/reset-password/actions.ts.
 */
export async function changePassword(formData: FormData) {
  const supabase = await createClient();

  const current = (formData.get("current_password") as string) ?? "";
  const next = (formData.get("new_password") as string) ?? "";

  if (next.length < MIN_PASSWORD_LENGTH) {
    failPassword(`Password must be at least ${MIN_PASSWORD_LENGTH} characters.`);
  }

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user?.email) {
    failPassword("Could not read your account. Sign in again and retry.");
  }

  const { error: reauth } = await supabase.auth.signInWithPassword({
    email: user.email,
    password: current,
  });

  if (reauth) {
    failPassword("Current password is incorrect.");
  }

  const { error } = await supabase.auth.updateUser({ password: next });
  if (error) {
    failPassword(error.message);
  }

  revalidatePath("/", "layout");
  redirect("/app/settings?password_saved=1");
}
