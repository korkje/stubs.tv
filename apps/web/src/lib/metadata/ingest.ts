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
 * Maps a provider ID to our internal ID, creating a stub row if this is the
 * first time we have seen the title. The database function does this in one
 * transaction so concurrent ingests cannot produce duplicates.
 */
async function resolveEntity(
  entityType: EntityType,
  providerId: string,
  name: string
): Promise<number> {
  const supabase = createServiceClient();

  const { data, error } = await supabase.rpc("resolve_entity", {
    p_entity_type: entityType,
    p_provider: PROVIDER,
    p_provider_id: providerId,
    p_name: name,
  });

  check(`resolve ${entityType} ${providerId}`, error);
  return data as number;
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
 * filled in when the title is actually opened.
 */
export async function resolveSearchResults(
  results: SearchResult[]
): Promise<Map<string, number>> {
  const entries = await Promise.all(
    results.map(async (result) => {
      const entityType: EntityType = result.kind === "series" ? "series" : "movie";
      const id = await resolveEntity(entityType, result.providerId, result.name);
      return [`${result.kind}:${result.providerId}`, id] as const;
    })
  );

  return new Map(entries);
}

/**
 * Ensures a series and its episodes are present and reasonably fresh.
 * Safe to call on every page view: it no-ops when the cache is warm.
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

  if (!detail) return;

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
      provider_updated_at: detail.providerUpdatedAt,
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

  const { data: upserted, error: episodeError } = await supabase
    .from("episodes")
    .upsert(
      episodes.map((episode) => ({
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
    episodes.map((episode) => [`${episode.seasonNumber}:${episode.number}`, episode.providerId])
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
    const { error: mappingError } = await supabase
      .from("external_ids")
      .upsert(mappings, { onConflict: "provider,entity_type,provider_id" });

    check("map episode provider IDs", mappingError);
  }
}

/** Ensures a movie is present and reasonably fresh. */
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
  if (!detail) return;

  const { error: updateError } = await supabase
    .from("movies")
    .update({
      name: detail.name,
      overview: detail.overview,
      released: detail.released,
      genres: detail.genres,
      runtime_min: detail.runtimeMin,
      poster_url: detail.posterUrl,
      provider_updated_at: detail.providerUpdatedAt,
      fetched_at: new Date().toISOString(),
    })
    .eq("id", movieId);

  check("update movie", updateError);
}

/** Route helper: which detail page a search result should link to. */
export function titlePath(kind: TitleKind, internalId: number): string {
  return kind === "series" ? `/app/series/${internalId}` : `/app/movies/${internalId}`;
}
