"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

/**
 * Mints one invite for the signed-in user. The allowance (and the admin
 * bypass) is enforced inside the database function, so a stale page cannot
 * be used to mint past the cap — it just gets the error back.
 */
export async function createInvite() {
  const supabase = await createClient();

  const { error } = await supabase.rpc("create_invite");
  if (error) throw new Error(`Could not create an invite: ${error.message}`);

  revalidatePath("/app");
}
