import "server-only";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

/**
 * Auth + entitlement gate for mutating actions. plan = 'free' is read-only
 * (ADR-0014): comp and paid pass, anything else — including a missing
 * profile row — is sent to the plans page rather than thrown, because a
 * paywall hit is a designed funnel event, not a failure; a thrown error
 * would surface as the generic error boundary.
 *
 * This is deliberately app-layer only: RLS already scopes every write to
 * the caller's own rows, so a free user forging PostgREST calls can only
 * pollute their own history. If that ever becomes an abuse target, split
 * the FOR ALL policies per-command with a plan check.
 */
export async function requireWriteAccess() {
  const supabase = await createClient();
  const [
    {
      data: { user },
    },
    { data: profile },
  ] = await Promise.all([
    supabase.auth.getUser(),
    supabase.from("profiles").select("plan").maybeSingle(),
  ]);

  if (!user) throw new Error("Not signed in");
  if (profile?.plan !== "comp" && profile?.plan !== "paid") {
    redirect("/app/plans");
  }

  return { supabase, userId: user.id };
}
