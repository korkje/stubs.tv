"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

const SPECIALS = new Set(["hidden", "uncounted", "counted"]);
const SYNOPSES = new Set(["show", "scramble", "hide"]);
const TABS = new Set(["watching", "account", "billing"]);

/** Keeps the save round-trip on the tab whose form was submitted. */
function settingsUrl(formData: FormData, params: Record<string, string>) {
  const tab = (formData.get("tab") as string) ?? "";
  const search = new URLSearchParams(params);
  if (TABS.has(tab)) search.set("tab", tab);
  return `/app/settings?${search}`;
}

/**
 * Saves a settings form. The settings page splits its fields across tabbed
 * forms, so only the fields a form actually posted are updated — a form
 * without display_name must not null it out. RLS restricts the update to
 * the caller's own row and the column grant to exactly these columns; the
 * checks here just turn a tampered form into a friendly error instead of a
 * constraint violation.
 */
export async function updateSettings(formData: FormData) {
  const supabase = await createClient();

  const updates: {
    display_name?: string | null;
    timezone?: string | null;
    specials?: string;
    synopsis_mode?: string;
    bulk_mark_specials?: boolean;
  } = {};

  if (formData.has("display_name")) {
    const displayName = ((formData.get("display_name") as string) ?? "").trim();
    updates.display_name = displayName || null;
  }

  if (formData.has("timezone")) {
    const timezone = ((formData.get("timezone") as string) ?? "").trim();
    if (timezone) {
      try {
        new Intl.DateTimeFormat("en", { timeZone: timezone });
      } catch {
        redirect(settingsUrl(formData, { error: "Unknown timezone." }));
      }
    }
    updates.timezone = timezone || null;
  }

  if (formData.has("specials")) {
    const specials = (formData.get("specials") as string) ?? "uncounted";
    if (!SPECIALS.has(specials)) {
      redirect(settingsUrl(formData, { error: "Invalid settings values." }));
    }
    updates.specials = specials;
    // The checkbox rides with the specials group; absent means unchecked.
    updates.bulk_mark_specials = formData.get("bulk_mark_specials") === "on";
  }

  if (formData.has("synopsis_mode")) {
    const synopsisMode = (formData.get("synopsis_mode") as string) ?? "show";
    if (!SYNOPSES.has(synopsisMode)) {
      redirect(settingsUrl(formData, { error: "Invalid settings values." }));
    }
    updates.synopsis_mode = synopsisMode;
  }

  if (Object.keys(updates).length > 0) {
    const { error } = await supabase
      .from("profiles")
      .update(updates)
      .eq("user_id", (await supabase.auth.getUser()).data.user?.id ?? "");

    if (error) {
      redirect(settingsUrl(formData, { error: error.message }));
    }
  }

  // Settings shape what most pages show.
  revalidatePath("/", "layout");
  redirect(settingsUrl(formData, { saved: "1" }));
}

/** Mirrors minimum_password_length in supabase/config.toml. */
const MIN_PASSWORD_LENGTH = 6;

function failPassword(message: string): never {
  redirect(
    `/app/settings?tab=account&password_error=${encodeURIComponent(message)}`
  );
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
  redirect("/app/settings?tab=account&password_saved=1");
}
