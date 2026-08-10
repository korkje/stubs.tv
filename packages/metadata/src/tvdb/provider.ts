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
  TvdbEpisodesPage,
  TvdbMovieExtended,
  TvdbSearchResult,
  TvdbSeriesExtended,
} from "./dto";
import { mapEpisode, mapMovie, mapSearchResult, mapSeries } from "./map";

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
      const body = await client.get<TvdbSeriesExtended>(`/series/${id}/extended?short=true`);
      return body?.data ? mapSeries(body.data) : null;
    },

    async getEpisodes(id: ProviderId): Promise<EpisodeDetail[]> {
      const episodes: EpisodeDetail[] = [];

      for (let page = 0; page < MAX_EPISODE_PAGES; page++) {
        const body = await client.get<TvdbEpisodesPage>(
          `/series/${id}/episodes/default?page=${page}`
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
  };
}
