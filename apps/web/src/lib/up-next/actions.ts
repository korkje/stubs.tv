"use server";

import { createClient } from "@/lib/supabase/server";

export interface UpNextEpisode {
  episode_id: number;
  series_id: number;
  series_name: string;
  poster_url: string | null;
  season_number: number;
  episode_number: number;
  episode_name: string | null;
  aired: string;
  runtime_min: number | null;
}

/**
 * One keyset page of the up-next feed. `before` walks into the past
 * (newest first), otherwise into the future (soonest first); the cursor is
 * exclusive for the past and inclusive for the future, so seeding both
 * directions with (today, 0) splits cleanly at the Today marker.
 */
export async function fetchUpNext(
  before: boolean,
  cursorAired: string,
  cursorId: number,
  limit = 20
): Promise<UpNextEpisode[]> {
  const supabase = await createClient();

  const { data, error } = await supabase.rpc("up_next", {
    p_before: before,
    p_aired: cursorAired,
    p_id: cursorId,
    p_limit: limit,
  });

  if (error) throw new Error(`Could not load the feed: ${error.message}`);
  return (data ?? []) as UpNextEpisode[];
}
