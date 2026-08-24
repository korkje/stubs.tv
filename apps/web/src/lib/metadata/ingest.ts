import "server-only";

import type { SearchResult, TitleKind } from "@stubs/metadata";
import { createServiceClient } from "@/lib/supabase/service";
import { getMetadataProvider } from "./provider";

/** How long a fully-fetched title is trusted before we refresh it. */
const FRESH_FOR_MS = 12 * 60 * 60 * 1000;

const PROVIDER = "tvdb" as const;

type EntityType = "series" | "movie" | "person";

function isStale(fetchedAt: string | null): boolean {
  if (!fetchedAt) return true; // stub row: never fully fetched
  return Date.now() - new Date(fetchedAt).getTime() > FRESH_FOR_MS;
}

/**
 * Postgrest reports failures in the result rather than throwing, so every
 * write has to be checked explicitly — otherwise a permission or constraint
 * problem looks exactly like "nothing needed doing".
 */
function check(context: string, error: { message: string } | null): void {
  if (error) throw new Error(`Metadata ingestion failed (${context}): ${error.message}`);
}

/** Looks up the provider ID for an internal ID, or null if we do not have one. */
async function providerIdFor(entityType: EntityType, entityId: number): Promise<string | null> {
  const supabase = createServiceClient();

  const { data, error } = await supabase
    .from("external_ids")
    .select("provider_id")
    .eq("entity_type", entityType)
    .eq("entity_id", entityId)
    .eq("provider", PROVIDER)
    .maybeSingle();

  check(`lookup ${entityType} ${entityId}`, error);
  return data?.provider_id ?? null;
}

/**
 * Gives every search result an internal ID so links can use our own IDs
 * rather than leaking the provider's (ADR-0004). Rows start as stubs and are
 * filled in when the title is actually opened. One RPC for the whole page:
 * per-hit calls would spend most of the Workers subrequest budget on their
 * own.
 */
export async function resolveSearchResults(
  results: SearchResult[]
): Promise<Map<string, number>> {
  if (results.length === 0) return new Map();

  const supabase = createServiceClient();

  const { data, error } = await supabase.rpc("resolve_entities", {
    p_provider: PROVIDER,
    p_entities: results.map((result) => ({
      entity_type: result.kind,
      provider_id: result.providerId,
      name: result.name,
    })),
  });

  check("resolve search results", error);
  return new Map(Object.entries((data ?? {}) as Record<string, number>));
}

/**
 * Popularity scores for a page of search hits, keyed like `ids`
 * ("kind:providerId"). Cached scores are read from our rows; missing ones
 * are fetched from the provider (its search API returns no relevance signal
 * whatsoever, so this is what puts the famous titles first) and written back,
 * so each title pays the extra request once ever. Backfill failures degrade
 * to provider order for the affected hits rather than failing the page.
 */
export async function searchScores(
  results: SearchResult[],
  ids: Map<string, number>
): Promise<Map<string, number>> {
  const supabase = createServiceClient();

  const byKind = (kind: TitleKind) =>
    results
      .filter((r) => r.kind === kind)
      .map((r) => ids.get(`${kind}:${r.providerId}`))
      .filter((id): id is number => id != null);
  const seriesIds = byKind("series");
  const movieIds = byKind("movie");

  const [seriesRows, movieRows] = await Promise.all([
    seriesIds.length
      ? supabase.from("series").select("id, score").in("id", seriesIds)
      : { data: [], error: null },
    movieIds.length
      ? supabase.from("movies").select("id, score").in("id", movieIds)
      : { data: [], error: null },
  ]);

  check("read series scores", seriesRows.error);
  check("read movie scores", movieRows.error);

  const stored = new Map<string, number | null>();
  for (const row of seriesRows.data ?? []) stored.set(`series:${row.id}`, row.score);
  for (const row of movieRows.data ?? []) stored.set(`movie:${row.id}`, row.score);

  const scores = new Map<string, number>();
  const missing: { key: string; kind: TitleKind; providerId: string; id: number }[] = [];

  for (const result of results) {
    const key = `${result.kind}:${result.providerId}`;
    const id = ids.get(key);
    if (id == null) continue;

    const cached = stored.get(`${result.kind}:${id}`);
    if (cached != null) scores.set(key, cached);
    else missing.push({ key, kind: result.kind, providerId: result.providerId, id });
  }

  if (missing.length === 0) return scores;

  const provider = getMetadataProvider();
  const fetched = await Promise.allSettled(
    missing.map(async (m) => ({ ...m, score: await provider.getScore(m.kind, m.providerId) }))
  );

  const writes: { entity_type: TitleKind; id: number; score: number }[] = [];
  for (const outcome of fetched) {
    if (outcome.status !== "fulfilled") continue;
    // Null score on a successful fetch means the provider has none: store 0
    // so the title still counts as scored and is never fetched again.
    const value = outcome.value.score ?? 0;
    scores.set(outcome.value.key, value);
    writes.push({ entity_type: outcome.value.kind, id: outcome.value.id, score: value });
  }

  if (writes.length > 0) {
    // Ranking already has the values in hand; a failed write only means the
    // next search fetches them again.
    const { error } = await supabase.rpc("set_title_scores", { p_scores: writes });
    if (error) console.error(`Could not cache title scores: ${error.message}`);
  }

  return scores;
}

/**
 * Ensures a series and its episodes are present and reasonably fresh.
 * Safe to call on every page view: it no-ops when the cache is warm. (The
 * /updates sync needs no bypass here: it nulls fetched_at, which this
 * function already treats as stale.)
 */
export async function ensureSeriesIngested(seriesId: number): Promise<void> {
  const supabase = createServiceClient();

  const { data: existing, error: readError } = await supabase
    .from("series")
    .select("fetched_at")
    .eq("id", seriesId)
    .maybeSingle();

  check("read series", readError);
  if (existing && !isStale(existing.fetched_at)) return;

  const providerId = await providerIdFor("series", seriesId);
  if (!providerId) return;

  const provider = getMetadataProvider();
  const [detail, episodes] = await Promise.all([
    provider.getSeries(providerId),
    provider.getEpisodes(providerId),
  ]);

  if (!detail) {
    // Gone at the provider (deleted or merged away). Stamp fetched_at
    // anyway: a vanished row that stays eternally stalest would occupy a
    // sweep slot every hour forever. The data we hold keeps rendering.
    if (existing) {
      const { error } = await supabase
        .from("series")
        .update({ fetched_at: new Date().toISOString() })
        .eq("id", seriesId);
      check("stamp vanished series", error);
    }
    return;
  }

  const { error: updateError } = await supabase
    .from("series")
    .update({
      name: detail.name,
      overview: detail.overview,
      first_aired: detail.firstAired,
      status: detail.status,
      genres: detail.genres,
      runtime_min: detail.runtimeMin,
      poster_url: detail.posterUrl,
      backdrop_url: detail.backdropUrl,
      provider_updated_at: detail.providerUpdatedAt,
      score: detail.score ?? 0,
      fetched_at: new Date().toISOString(),
    })
    .eq("id", seriesId);

  check("update series", updateError);

  if (detail.seasons.length > 0) {
    const { error: seasonError } = await supabase.from("seasons").upsert(
      detail.seasons.map((season) => ({
        series_id: seriesId,
        number: season.number,
        name: season.name,
        poster_url: season.posterUrl,
      })),
      { onConflict: "series_id,number" }
    );

    check("upsert seasons", seasonError);
  }

  if (episodes.length === 0) return;

  // Postgres rejects an upsert that touches the same row twice, so collapse
  // any duplicate (season, episode) pairs the provider may return.
  const uniqueEpisodes = [
    ...new Map(episodes.map((e) => [`${e.seasonNumber}:${e.number}`, e])).values(),
  ];

  const { data: upserted, error: episodeError } = await supabase
    .from("episodes")
    .upsert(
      uniqueEpisodes.map((episode) => ({
        series_id: seriesId,
        season_number: episode.seasonNumber,
        number: episode.number,
        name: episode.name,
        overview: episode.overview,
        aired: episode.aired,
        runtime_min: episode.runtimeMin,
        image_url: episode.imageUrl,
        provider_updated_at: episode.providerUpdatedAt,
      })),
      { onConflict: "series_id,season_number,number" }
    )
    .select("id, season_number, number");

  check("upsert episodes", episodeError);
  if (!upserted) return;

  // Record provider IDs for the episodes so the future refresh job can match
  // them up. Returned rows are not in input order, so match on the natural key.
  const providerIdByPosition = new Map(
    uniqueEpisodes.map((episode) => [
      `${episode.seasonNumber}:${episode.number}`,
      episode.providerId,
    ])
  );

  const mappings = upserted
    .map((row) => {
      const episodeProviderId = providerIdByPosition.get(`${row.season_number}:${row.number}`);
      return episodeProviderId
        ? {
            entity_type: "episode" as const,
            entity_id: row.id,
            provider: PROVIDER,
            provider_id: episodeProviderId,
          }
        : null;
    })
    .filter((m): m is NonNullable<typeof m> => m !== null);

  if (mappings.length > 0) {
    // Delete-then-insert rather than upsert: external_ids carries TWO unique
    // constraints (the provider-id PK and one per entity), and an upsert can
    // only resolve one. When TVDB reissues an episode under a new id — which
    // the /updates feed shows happens routinely — the old mapping collides on
    // the entity-side constraint and would poison every future refresh of the
    // series. Clearing both sides first makes the write idempotent.
    const episodeIds = mappings.map((m) => m.entity_id);
    const providerIds = mappings.map((m) => m.provider_id);
    for (let i = 0; i < episodeIds.length; i += 200) {
      const { error } = await supabase
        .from("external_ids")
        .delete()
        .eq("provider", PROVIDER)
        .eq("entity_type", "episode")
        .or(
          `entity_id.in.(${episodeIds.slice(i, i + 200).join(",")}),provider_id.in.(${providerIds
            .slice(i, i + 200)
            .map((id) => `"${id}"`)
            .join(",")})`
        );
      check("clear stale episode mappings", error);
    }

    const { error: mappingError } = await supabase.from("external_ids").insert(mappings);
    check("map episode provider IDs", mappingError);
  }
}

/** Ensures a movie is present and reasonably fresh. See ensureSeriesIngested
 *  for the vanished-record semantics, which are identical. */
export async function ensureMovieIngested(movieId: number): Promise<void> {
  const supabase = createServiceClient();

  const { data: existing, error: readError } = await supabase
    .from("movies")
    .select("fetched_at")
    .eq("id", movieId)
    .maybeSingle();

  check("read movie", readError);
  if (existing && !isStale(existing.fetched_at)) return;

  const providerId = await providerIdFor("movie", movieId);
  if (!providerId) return;

  const detail = await getMetadataProvider().getMovie(providerId);
  if (!detail) {
    if (existing) {
      const { error } = await supabase
        .from("movies")
        .update({ fetched_at: new Date().toISOString() })
        .eq("id", movieId);
      check("stamp vanished movie", error);
    }
    return;
  }

  const { error: updateError } = await supabase
    .from("movies")
    .update({
      name: detail.name,
      overview: detail.overview,
      released: detail.released,
      genres: detail.genres,
      runtime_min: detail.runtimeMin,
      poster_url: detail.posterUrl,
      backdrop_url: detail.backdropUrl,
      provider_updated_at: detail.providerUpdatedAt,
      score: detail.score ?? 0,
      fetched_at: new Date().toISOString(),
    })
    .eq("id", movieId);

  check("update movie", updateError);
}

/** Route helper: which detail page a search result should link to. */
export function titlePath(kind: TitleKind, internalId: number): string {
  return kind === "series" ? `/app/series/${internalId}` : `/app/movies/${internalId}`;
}
