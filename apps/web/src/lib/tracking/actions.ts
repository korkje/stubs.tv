"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

type WatchableType = "episode" | "movie";
type RateableType = "series" | "season" | "episode" | "movie";

/**
 * Every action below relies on row level security rather than checking
 * ownership itself: the policies only permit rows whose user_id matches the
 * caller, so a forged id in a form cannot touch someone else's history.
 */
async function requireUser() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) throw new Error("Not signed in");
  return { supabase, userId: user.id };
}

function fail(context: string, error: { message: string } | null): void {
  if (error) throw new Error(`Could not ${context}: ${error.message}`);
}

/** Marks one episode or film as seen, dated now. */
export async function markSeen(
  entityType: WatchableType,
  entityId: number,
  revalidate: string
) {
  const { supabase, userId } = await requireUser();

  const { error } = await supabase.from("watches").upsert(
    {
      user_id: userId,
      entity_type: entityType,
      entity_id: entityId,
      watched_at: new Date().toISOString(),
    },
    { onConflict: "user_id,entity_type,entity_id", ignoreDuplicates: true }
  );

  fail("mark as seen", error);
  revalidatePath(revalidate);
}

export async function unmarkSeen(
  entityType: WatchableType,
  entityId: number,
  revalidate: string
) {
  const { supabase, userId } = await requireUser();

  const { error } = await supabase
    .from("watches")
    .delete()
    .eq("user_id", userId)
    .eq("entity_type", entityType)
    .eq("entity_id", entityId);

  fail("unmark", error);
  revalidatePath(revalidate);
}

/**
 * Marks many episodes at once (a season, or a whole show including specials).
 *
 * watched_at is left null: these are "seen, date unknown". Stamping now() would
 * make a backfill of years-old viewing indistinguishable from a real binge in
 * the activity analytics. ignoreDuplicates keeps already-watched episodes'
 * real dates intact.
 */
export async function markManySeen(episodeIds: number[], revalidate: string) {
  if (episodeIds.length === 0) return;

  const { supabase, userId } = await requireUser();

  const { error } = await supabase.from("watches").upsert(
    episodeIds.map((entityId) => ({
      user_id: userId,
      entity_type: "episode" as const,
      entity_id: entityId,
      watched_at: null,
    })),
    { onConflict: "user_id,entity_type,entity_id", ignoreDuplicates: true }
  );

  fail("mark episodes as seen", error);
  revalidatePath(revalidate);
}

export async function unmarkManySeen(episodeIds: number[], revalidate: string) {
  if (episodeIds.length === 0) return;

  const { supabase, userId } = await requireUser();

  const { error } = await supabase
    .from("watches")
    .delete()
    .eq("user_id", userId)
    .eq("entity_type", "episode")
    .in("entity_id", episodeIds);

  fail("unmark episodes", error);
  revalidatePath(revalidate);
}

export async function setFollowing(
  seriesId: number,
  following: boolean,
  revalidate: string
) {
  const { supabase, userId } = await requireUser();

  if (following) {
    const { error } = await supabase.from("follows").upsert(
      { user_id: userId, entity_type: "series", entity_id: seriesId },
      { onConflict: "user_id,entity_type,entity_id", ignoreDuplicates: true }
    );
    fail("follow", error);
  } else {
    const { error } = await supabase
      .from("follows")
      .delete()
      .eq("user_id", userId)
      .eq("entity_type", "series")
      .eq("entity_id", seriesId);
    fail("unfollow", error);
  }

  revalidatePath(revalidate);
}

/** Sets or clears a 1–10 score. Ratings are independent of watch state. */
export async function setRating(
  entityType: RateableType,
  entityId: number,
  score: number | null,
  revalidate: string
) {
  const { supabase, userId } = await requireUser();

  if (score === null) {
    const { error } = await supabase
      .from("ratings")
      .delete()
      .eq("user_id", userId)
      .eq("entity_type", entityType)
      .eq("entity_id", entityId);
    fail("clear rating", error);
  } else {
    const { error } = await supabase.from("ratings").upsert(
      {
        user_id: userId,
        entity_type: entityType,
        entity_id: entityId,
        score,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "user_id,entity_type,entity_id" }
    );
    fail("save rating", error);
  }

  revalidatePath(revalidate);
}
