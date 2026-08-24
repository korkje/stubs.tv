"use server";

import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { isOAuthProvider } from "@/lib/auth/providers";
import { safeNext } from "@/lib/redirects";

export async function login(formData: FormData) {
  const supabase = await createClient();
  const next = safeNext(formData.get("next"));

  const { error } = await supabase.auth.signInWithPassword({
    email: formData.get("email") as string,
    password: formData.get("password") as string,
  });

  if (error) {
    const params = new URLSearchParams({ error: error.message });
    if (next) params.set("next", next);
    redirect(`/login?${params}`);
  }

  revalidatePath("/", "layout");
  redirect(next ?? "/app");
}

/**
 * Starts the OAuth dance for a provider button (login and signup share
 * this — to GoTrue they are the same operation). The server client returns
 * the provider's authorization URL rather than redirecting the browser
 * itself, so the action ends with an explicit redirect to it; the round
 * trip comes back to /auth/callback, which exchanges the code and honours
 * `next`.
 */
export async function signInWithProvider(formData: FormData) {
  const provider = formData.get("provider");
  if (!isOAuthProvider(provider)) redirect("/login");

  const next = safeNext(formData.get("next"));

  // Origin from forwarded headers, like the calendar URL in settings: the
  // worker sits behind Cloudflare, and this must be right for GoTrue to
  // send the user back to the deployment they started on.
  const requestHeaders = await headers();
  const host =
    requestHeaders.get("x-forwarded-host") ?? requestHeaders.get("host");
  const proto = requestHeaders.get("x-forwarded-proto") ?? "https";
  const callback = new URL(`${proto}://${host}/auth/callback`);
  if (next) callback.searchParams.set("next", next);

  const supabase = await createClient();
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider,
    options: { redirectTo: callback.toString() },
  });

  if (error || !data?.url) {
    const params = new URLSearchParams({
      error: error?.message ?? "Could not start the sign-in. Try again.",
    });
    if (next) params.set("next", next);
    redirect(`/login?${params}`);
  }

  redirect(data.url);
}

export async function signout() {
  const supabase = await createClient();
  await supabase.auth.signOut();

  revalidatePath("/", "layout");
  redirect("/");
}
