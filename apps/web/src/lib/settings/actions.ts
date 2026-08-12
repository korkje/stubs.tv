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
