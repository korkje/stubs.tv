// Raw TheTVDB v4 wire types — only the fields we consume. These never leave
// this package; map.ts converts them to the domain types in ../types.ts.
//
// Note the deliberate inconsistency in the API itself: search results are
// snake_case with string IDs, while entity endpoints are camelCase with
// numeric IDs. Both are modelled faithfully rather than unified early.

export interface TvdbEnvelope<T> {
  status: string;
  data: T;
  links?: { next: string | null; total_items?: number };
}

export interface TvdbSearchResult {
  tvdb_id?: string;
  /** In the record's *original* language — 千と千尋の神隠し, not Spirited Away. */
  name?: string;
  /** "series" | "movie" | "person" | … */
  type?: string;
  year?: string;
  overview?: string;
  image_url?: string;
  first_air_time?: string;
  /** Language code → title. Where the English name actually lives. */
  translations?: Record<string, string>;
  /** Language code → synopsis. */
  overviews?: Record<string, string>;
}

interface TvdbNamed {
  name?: string;
}

export interface TvdbSeasonSummary {
  number?: number;
  name?: string;
  image?: string;
  /** Aired Order / DVD Order / Absolute Order — only "official" is canonical. */
  type?: { type?: string };
}

export interface TvdbSeriesExtended {
  id: number;
  /** Original language; prefer the English entry in translations. */
  name?: string;
  overview?: string;
  firstAired?: string;
  status?: TvdbNamed;
  genres?: TvdbNamed[];
  averageRuntime?: number;
  image?: string;
  lastUpdated?: string;
  seasons?: TvdbSeasonSummary[];
  translations?: TvdbTranslations;
  /** Empty when the response is requested with short=true. */
  artworks?: TvdbArtwork[];
  score?: number;
}

/**
 * The base /series/{id} and /movies/{id} records, read only for the score —
 * a fraction of the extended payload.
 */
export interface TvdbBaseTitle {
  score?: number;
}

export interface TvdbEpisode {
  id: number;
  name?: string;
  overview?: string;
  aired?: string;
  runtime?: number;
  image?: string;
  number?: number;
  seasonNumber?: number;
  lastUpdated?: string;
}

export interface TvdbEpisodesPage {
  episodes?: TvdbEpisode[];
}

export interface TvdbArtwork {
  image?: string;
  /** 3 = series background, 15 = movie background. See /artwork/types. */
  type?: number;
  score?: number;
  includesText?: boolean;
}

/** Response shape of /series/{id}/artworks. */
export interface TvdbArtworks {
  artworks?: TvdbArtwork[];
}

export interface TvdbTranslation {
  name?: string;
  overview?: string;
  language?: string;
  isPrimary?: boolean;
}

export interface TvdbTranslations {
  nameTranslations?: TvdbTranslation[];
  overviewTranslations?: TvdbTranslation[];
}

export interface TvdbMovieExtended {
  id: number;
  name?: string;
  /** Absent on this endpoint — movie synopses live in translations. */
  overview?: string;
  runtime?: number;
  status?: TvdbNamed;
  genres?: TvdbNamed[];
  image?: string;
  lastUpdated?: string;
  first_release?: { date?: string };
  releases?: { country?: string; date?: string }[];
  translations?: TvdbTranslations;
  /** Present even with short=true, unlike the series endpoint. */
  artworks?: TvdbArtwork[];
  score?: number;
}
