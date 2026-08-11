import type {
  EpisodeDetail,
  MetadataProvider,
  MovieDetail,
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

export function createTvdbProvider(apiKey: string): MetadataProvider {
  const client = new TvdbClient(apiKey);

  return {
    name: "tvdb",

    async search(query, options) {
      const trimmed = query.trim();
      if (!trimmed) return [];

      const params = new URLSearchParams({
        query: trimmed,
        limit: String(options?.limit ?? 20),
      });

      const body = await client.get<TvdbSearchResult[]>(`/search?${params}`);

      // One mixed-type call, filtered down to the kinds we track.
      return (body?.data ?? [])
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
  };
}
