import type {
  ChangedSinceResult,
  EpisodeDetail,
  MetadataProvider,
  MovieDetail,
  ProviderChange,
  ProviderId,
  SearchResult,
  SeriesDetail,
} from "../types";
import { TvdbClient } from "./client";
import type {
  TvdbArtworks,
  TvdbBaseTitle,
  TvdbEpisodesPage,
  TvdbMovieExtended,
  TvdbSearchResult,
  TvdbSeriesExtended,
  TvdbUpdateRecord,
} from "./dto";
import {
  SERIES_BACKGROUND,
  mapEpisode,
  mapMovie,
  mapSearchResult,
  mapSeries,
  pickBackdrop,
} from "./map";

/** Guard against a malformed `links.next` chain looping forever. */
const MAX_EPISODE_PAGES = 20;

/**
 * /updates serves 500 records per page and the whole catalogue's hourly
 * churn is one or two pages per type, so this is ~an order of magnitude of
 * headroom, not a limit anyone should meet. Callers can lower it.
 */
const MAX_UPDATE_PAGES = 20;

/** /updates entityType values → our entity types. Everything else (artwork,
 *  people, translations, …) is churn we don't store. */
const UPDATE_ENTITY_TYPES = {
  series: "series",
  movies: "movie",
  episodes: "episode",
} as const;

function mapUpdateRecord(
  raw: TvdbUpdateRecord,
  entityType: ProviderChange["entityType"]
): ProviderChange | null {
  if (raw.recordId == null) return null;
  const method = raw.method;
  if (method !== "create" && method !== "update" && method !== "delete") return null;

  return {
    entityType,
    providerId: String(raw.recordId),
    method,
    // A cross-type merge target is not representable as "same entity, new
    // id" — surface no merge so the caller treats it as a plain delete.
    mergeToId:
      raw.mergeToId != null &&
      (raw.mergeToEntityType == null || UPDATE_ENTITY_TYPES[raw.mergeToEntityType as keyof typeof UPDATE_ENTITY_TYPES] === entityType)
        ? String(raw.mergeToId)
        : null,
    seriesProviderId: raw.seriesId != null ? String(raw.seriesId) : null,
  };
}

export function createTvdbProvider(apiKey: string): MetadataProvider {
  const client = new TvdbClient(apiKey);

  return {
    name: "tvdb",

    async search(query, options) {
      const trimmed = query.trim();
      if (!trimmed) return [];

      // One type-scoped call per kind we track, never the mixed search:
      // /search fills its result slots with every entity type, and a query
      // matching many people ("Conan") starves the shows and films we are
      // actually after down to a hit or two.
      const [series, movies] = await Promise.all(
        (["series", "movie"] as const).map((type) => {
          const params = new URLSearchParams({
            query: trimmed,
            type,
            limit: String(options?.limit ?? 20),
          });
          return client.get<TvdbSearchResult[]>(`/search?${params}`);
        })
      );

      return [...(series?.data ?? []), ...(movies?.data ?? [])]
        .map(mapSearchResult)
        .filter((r): r is SearchResult => r !== null);
    },

    async getSeries(id: ProviderId): Promise<SeriesDetail | null> {
      // short=true omits per-episode and cast payloads we do not need here.
      // meta=translations is what carries the English title and synopsis for
      // shows recorded in another language.
      //
      // It also omits artwork, so backgrounds need their own request. That is
      // still far cheaper than the full record: 11KB against 93KB.
      const [body, artworks] = await Promise.all([
        client.get<TvdbSeriesExtended>(`/series/${id}/extended?meta=translations&short=true`),
        client.get<TvdbArtworks>(`/series/${id}/artworks?type=${SERIES_BACKGROUND}`),
      ]);

      if (!body?.data) return null;
      return mapSeries(body.data, pickBackdrop(artworks?.data?.artworks, SERIES_BACKGROUND));
    },

    async getEpisodes(id: ProviderId): Promise<EpisodeDetail[]> {
      const episodes: EpisodeDetail[] = [];

      for (let page = 0; page < MAX_EPISODE_PAGES; page++) {
        // The /eng variant returns English episode titles and synopses. It is
        // never worse than the untranslated list: identical for English shows,
        // and populated where the plain list leaves names empty.
        const body = await client.get<TvdbEpisodesPage>(
          `/series/${id}/episodes/default/eng?page=${page}`
        );
        if (!body) break;

        for (const raw of body.data?.episodes ?? []) {
          const mapped = mapEpisode(raw);
          if (mapped) episodes.push(mapped);
        }

        if (!body.links?.next) break;
      }

      return episodes;
    },

    async getMovie(id: ProviderId): Promise<MovieDetail | null> {
      // meta=translations is required: the synopsis is not returned otherwise.
      const body = await client.get<TvdbMovieExtended>(
        `/movies/${id}/extended?meta=translations&short=true`
      );
      return body?.data ? mapMovie(body.data) : null;
    },

    async getScore(kind, id) {
      // The base record is a fraction of the extended payload; this exists so
      // search can backfill a whole results page of scores cheaply.
      const body = await client.get<TvdbBaseTitle>(
        `/${kind === "series" ? "series" : "movies"}/${id}`
      );
      return typeof body?.data?.score === "number" ? body.data.score : null;
    },

    async changedSince(since, options): Promise<ChangedSinceResult> {
      const sinceUnix = Math.floor(since.getTime() / 1000);
      const maxPages = options?.maxPagesPerType ?? MAX_UPDATE_PAGES;
      const changes: ProviderChange[] = [];
      let complete = true;

      // One filtered stream per type we store, rather than the unfiltered
      // feed: two thirds of the raw feed is artwork/translation/people churn
      // that would only be paged through and thrown away.
      for (const [tvdbType, entityType] of Object.entries(UPDATE_ENTITY_TYPES)) {
        let page = 0;
        for (; page < maxPages; page++) {
          const body = await client.get<TvdbUpdateRecord[]>(
            `/updates?since=${sinceUnix}&type=${tvdbType}&page=${page}`
          );
          if (!body) break;

          for (const raw of body.data ?? []) {
            const mapped = mapUpdateRecord(raw, entityType);
            if (mapped) changes.push(mapped);
          }

          if (!body.links?.next) break;
          if (page === maxPages - 1) complete = false;
        }
      }

      return { changes, complete };
    },
  };
}
