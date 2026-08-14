"use server";

import { createClient } from "@/lib/supabase/server";
import { SHOW_RUNTIME, ratingBounds, runtimeBounds, type Filters } from "@/lib/filters";

export interface UpNextEpisode {
  episode_id: number;
  series_id: number;
  series_name: string;
  poster_url: string | null;
  season_number: number;
  episode_number: number;
  episode_name: string | null;
  overview: string | null;
  aired: string;
  runtime_min: number | null;
  /**
   * Always false unless the feed was asked to include watched episodes —
   * but the rows have to carry it either way, because a row cannot know
   * which mode it is in and two things about it depend on the answer.
   */
  watched: boolean;
}

/**
 * One keyset page of the up-next feed. `before` walks into the past
 * (newest first), otherwise into the future (soonest first); the cursor is
 * exclusive for the past and inclusive for the future, so seeding both
 * directions with (today, 0) splits cleanly at the Today marker.
 *
 * Filters only narrow the candidate set the cursor walks — the keyset order
 * is the feed's identity and is never up for negotiation, which is also why
 * the feed takes no sort.
 */
export async function fetchUpNext(
  before: boolean,
  cursorAired: string,
  cursorId: number,
  limit = 20,
  filters?: Filters
): Promise<UpNextEpisode[]> {
  const supabase = await createClient();
  const rating = ratingBounds(filters?.rating ?? null);
  const runtime = runtimeBounds(filters?.runtime ?? null, SHOW_RUNTIME.max);

  const { data, error } = await supabase.rpc("up_next", {
    p_before: before,
    p_aired: cursorAired,
    p_id: cursorId,
    p_limit: limit,
    p_include_watched: filters?.includeWatched ?? false,
    // Null means "no bound" throughout, which is what an untouched facet is.
    // Still an array at the SQL boundary; the function predates the
    // single-select control and = any() costs nothing.
    p_status: filters?.status ? [filters.status] : undefined,
    p_rating_min: rating.min ?? undefined,
    p_rating_max: rating.max ?? undefined,
    p_runtime_min: runtime.min ?? undefined,
    p_runtime_max: runtime.max ?? undefined,
  });

  if (error) throw new Error(`Could not load the feed: ${error.message}`);
  return (data ?? []) as UpNextEpisode[];
}
