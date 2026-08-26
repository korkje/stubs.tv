"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { ResourceNotFound } from "@polar-sh/sdk/models/errors/resourcenotfound.js";
import { getPolarClient } from "@/lib/polar";
import { isOAuthProvider } from "@/lib/auth/providers";
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

/** Errors from the Sign-in methods card all land in its one callout. */
function failLink(message: string): never {
  redirect(
    `/app/settings?tab=account&link_error=${encodeURIComponent(message)}`
  );
}

/**
 * Emails the signed-in user a link to set (or change) their password — the
 * one flow that creates a password here, whether the account has one or
 * not. Reuses the recovery machinery wholesale: the emailed link lands on
 * /auth/reset-password, whose action refuses to trust the session and
 * spends the token on submit (ADR-0011), and which materializes the email
 * identity afterwards (ADR-0020). A settings form that changed the
 * password in place would need its own current-password reauth and would
 * dead-end OAuth-only accounts; the mailbox round trip covers both cases
 * with proof of ownership.
 */
export async function sendPasswordEmail() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user?.email) {
    failLink("Could not read your account. Sign in again and retry.");
  }

  const { error } = await supabase.auth.resetPasswordForEmail(user.email);
  if (error) {
    // Most likely GoTrue's email rate limit; its raw message names it.
    failLink(`Could not send the email: ${error.message}`);
  }

  redirect("/app/settings?tab=account&email_sent=1");
}

/**
 * Disconnects email/password sign-in. Not GoTrue's unlink: that removes
 * the identity row but leaves the password working (verified, ADR-0020),
 * which would make this button theater. The SQL function removes both
 * together and refuses when no other sign-in method remains — same rule
 * unlinkProvider enforces below. The account email survives as the
 * recovery anchor, so this can be undone from the Set up button.
 */
export async function unlinkEmailLogin() {
  const supabase = await createClient();

  const { error } = await supabase.rpc("remove_email_login");
  if (error) {
    failLink(
      error.message.includes("last sign-in method")
        ? "This is your only way to sign in — connect another method first."
        : error.message
    );
  }

  revalidatePath("/app/settings");
  redirect("/app/settings?tab=account&unlinked=1");
}

/**
 * Rotates the calendar feed token (ADR-0018). The URL is the credential,
 * so this is the "it leaked" recovery: every previously shared feed URL
 * stops working the moment this returns. The SQL function scopes the
 * update to auth.uid() and mints the token server-side — users never get
 * to choose their own.
 */
export async function regenerateCalendarToken() {
  const supabase = await createClient();

  const { error } = await supabase.rpc("regenerate_calendar_token");
  if (error) {
    redirect(
      `/app/settings?tab=watching&error=${encodeURIComponent(error.message)}`
    );
  }

  revalidatePath("/app/settings");
  redirect("/app/settings?tab=watching&calendar_saved=1");
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
 * The password check exists because a session alone is not proof
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

/**
 * Starts the OAuth dance that connects another sign-in method to the
 * *current* account (settings → Sign-in methods). Same round trip as the
 * login buttons, but through auth.linkIdentity, which attaches the identity
 * to the signed-in user regardless of the provider account's email — the
 * escape hatch for Apple relay addresses and mismatched emails. Requires
 * "manual linking" enabled on the Supabase project.
 */
export async function linkProvider(formData: FormData) {
  const provider = formData.get("provider");
  if (!isOAuthProvider(provider)) {
    redirect("/app/settings?tab=account");
  }

  const requestHeaders = await headers();
  const host =
    requestHeaders.get("x-forwarded-host") ?? requestHeaders.get("host");
  const proto = requestHeaders.get("x-forwarded-proto") ?? "https";
  const callback = new URL(`${proto}://${host}/auth/callback`);
  // Landing back on settings is also what routes callback errors (e.g.
  // identity_already_exists) to the settings page instead of /login.
  callback.searchParams.set("next", "/app/settings?tab=account&linked=1");

  const supabase = await createClient();
  const { data, error } = await supabase.auth.linkIdentity({
    provider,
    options: { redirectTo: callback.toString() },
  });

  if (error || !data?.url) {
    failLink(error?.message ?? "Could not start the connection. Try again.");
  }

  redirect(data.url);
}

/**
 * Disconnects a sign-in method. GoTrue refuses to remove the last identity;
 * the UI hides the button in that case and this re-checks anyway, so a
 * stale form can't strand the account.
 */
export async function unlinkProvider(formData: FormData) {
  const provider = formData.get("provider");
  if (!isOAuthProvider(provider)) {
    redirect("/app/settings?tab=account");
  }

  const supabase = await createClient();
  const { data, error: readError } = await supabase.auth.getUserIdentities();
  const identities = data?.identities ?? [];
  const identity = identities.find((i) => i.provider === provider);

  if (readError || !identity) {
    failLink("Could not find that connection. Reload and try again.");
  }

  if (identities.length < 2) {
    failLink(
      "This is your only way to sign in — set a password before disconnecting it."
    );
  }

  const { error } = await supabase.auth.unlinkIdentity(identity);
  if (error) {
    failLink(error.message);
  }

  revalidatePath("/app/settings");
  redirect("/app/settings?tab=account&unlinked=1");
}
