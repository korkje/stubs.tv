"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
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

export async function signout() {
  const supabase = await createClient();
  await supabase.auth.signOut();

  revalidatePath("/", "layout");
  redirect("/");
}
