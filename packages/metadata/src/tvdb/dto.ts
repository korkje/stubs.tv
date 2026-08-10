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
  name?: string;
  /** "series" | "movie" | "person" | … */
  type?: string;
  year?: string;
  overview?: string;
  image_url?: string;
  first_air_time?: string;
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
  name?: string;
  overview?: string;
  firstAired?: string;
  status?: TvdbNamed;
  genres?: TvdbNamed[];
  averageRuntime?: number;
  image?: string;
  lastUpdated?: string;
  seasons?: TvdbSeasonSummary[];
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

export interface TvdbTranslation {
  overview?: string;
  language?: string;
  isPrimary?: boolean;
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
  translations?: { overviewTranslations?: TvdbTranslation[] };
}
