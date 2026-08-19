"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { ResourceNotFound } from "@polar-sh/sdk/models/errors/resourcenotfound.js";
import { getPolarClient } from "@/lib/polar";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";

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

function failDelete(message: string): never {
  redirect(
    `/app/settings?tab=account&delete_error=${encodeURIComponent(message)}`
  );
}

/**
 * Deletes the signed-in user's account — the GDPR right to erasure
 * (docs/PRIVACY.md, ADR-0017). Every user table cascades from auth.users,
 * so one admin delete removes everything; there is no soft-delete.
 *
 * The password check mirrors changePassword: a session alone is not proof
 * the person at the keyboard is the owner, and deletion is the most
 * destructive thing an account can do.
 *
 * Order matters and must never be reversed: Polar first, then the auth
 * user. Deleting the account while an active subscription survives would
 * keep charging someone who can no longer reach their billing portal
 * through us. Polar's customer delete cancels active subscriptions
 * immediately, and anonymize hashes the PII they retain for tax/order
 * records (they are merchant of record, ADR-0013).
 */
export async function deleteAccount(formData: FormData) {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user?.email) {
    failDelete("Could not read your account. Sign in again and retry.");
  }

  const { error: reauth } = await supabase.auth.signInWithPassword({
    email: user.email,
    password: (formData.get("current_password") as string) ?? "",
  });

  if (reauth) {
    failDelete("Password is incorrect.");
  }

  const { data: billing, error: billingError } = await supabase
    .from("billing")
    .select("polar_customer_id, subscription_status")
    .maybeSingle();

  if (billingError) {
    failDelete(`Could not read billing state: ${billingError.message}`);
  }

  if (billing?.polar_customer_id) {
    const live =
      billing.subscription_status === "active" ||
      billing.subscription_status === "trialing";

    try {
      await getPolarClient().customers.delete({
        id: billing.polar_customer_id,
        anonymize: true,
      });
    } catch (err) {
      // Already gone on Polar's side — nothing left to cancel.
      if (!(err instanceof ResourceNotFound)) {
        // With a live subscription this MUST abort: proceeding would delete
        // the account and keep the charges. Without one (lapsed, lifetime,
        // or Polar not configured — local dev, self-hosted) erasure must
        // not be blocked by an unreachable payment provider.
        if (live) {
          failDelete(
            "We could not cancel your subscription. Nothing was deleted — " +
              "try again, or cancel it in the billing portal first."
          );
        }
        // One string: the worker's log drain serializes extra args poorly.
        console.error(
          `Polar customer delete failed during account deletion of ${user.id}: ` +
            (err instanceof Error ? err.message : String(err))
        );
      }
    }
  }

  const { error: deleteError } =
    await createServiceClient().auth.admin.deleteUser(user.id);

  if (deleteError) {
    failDelete(`Deletion failed: ${deleteError.message}. Nothing was deleted.`);
  }

  // The auth user is gone; local scope just clears this browser's cookies
  // (global would try to revoke tokens that no longer exist).
  await supabase.auth.signOut({ scope: "local" });
  redirect("/login?deleted=1");
}
