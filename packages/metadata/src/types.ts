// Provider-agnostic domain types. Nothing here mirrors a provider's wire
// format — mappers convert to these, and the rest of the app only ever sees
// these shapes (ADR-0004).

/** An entity's ID *at a provider*, always normalised to a string. */
export type ProviderId = string;

export type TitleKind = "series" | "movie";

export interface SearchResult {
  kind: TitleKind;
  providerId: ProviderId;
  name: string;
  year: number | null;
  overview: string | null;
  posterUrl: string | null;
}

export interface SeasonSummary {
  number: number;
  name: string | null;
  posterUrl: string | null;
}

export interface SeriesDetail {
  providerId: ProviderId;
  name: string;
  overview: string | null;
  /** ISO date (YYYY-MM-DD). */
  firstAired: string | null;
  status: string | null;
  genres: string[];
  /** Typical episode runtime in minutes. */
  runtimeMin: number | null;
  posterUrl: string | null;
  /** Landscape artwork, for wide layouts and phones. */
  backdropUrl: string | null;
  /** The provider's own last-modified stamp, ISO 8601. */
  providerUpdatedAt: string | null;
  /** The provider's popularity figure; ranks search results. Null = unknown. */
  score: number | null;
  seasons: SeasonSummary[];
}

export interface EpisodeDetail {
  providerId: ProviderId;
  seasonNumber: number;
  number: number;
  name: string | null;
  overview: string | null;
  aired: string | null;
  runtimeMin: number | null;
  imageUrl: string | null;
  providerUpdatedAt: string | null;
}

export interface MovieDetail {
  providerId: ProviderId;
  name: string;
  overview: string | null;
  released: string | null;
  genres: string[];
  runtimeMin: number | null;
  posterUrl: string | null;
  backdropUrl: string | null;
  providerUpdatedAt: string | null;
  /** The provider's popularity figure; ranks search results. Null = unknown. */
  score: number | null;
}

/** One record from a provider's change feed. */
export interface ProviderChange {
  entityType: "series" | "movie" | "episode";
  providerId: ProviderId;
  method: "create" | "update" | "delete";
  /**
   * When a delete is really a duplicate merge, the provider id of the
   * surviving record (same entity type unless the provider says otherwise —
   * cross-type merges are surfaced as-is for the caller to refuse).
   */
  mergeToId: ProviderId | null;
  /** For episodes: the parent series' provider id. TVDB omits it on a
   *  sizeable minority of episode records, so callers need a fallback. */
  seriesProviderId: ProviderId | null;
}

export interface ChangedSinceResult {
  changes: ProviderChange[];
  /**
   * False when a page budget stopped the read early — the caller must treat
   * the window as unreliable rather than assume it saw everything.
   */
  complete: boolean;
}

export interface MetadataProvider {
  /** Stable identifier, matching the `metadata_provider` enum in the database. */
  readonly name: "tvdb";
  /**
   * `limit` caps each kind separately (up to `limit` series plus `limit`
   * movies), not the total: the kinds are fetched independently so that
   * hits we track never compete for result slots with kinds we do not —
   * people, mostly. Order is not meaningful across kinds; callers rank.
   */
  search(query: string, options?: { limit?: number }): Promise<SearchResult[]>;
  getSeries(id: ProviderId): Promise<SeriesDetail | null>;
  getEpisodes(id: ProviderId): Promise<EpisodeDetail[]>;
  getMovie(id: ProviderId): Promise<MovieDetail | null>;
  /**
   * Just the popularity score for one title — a far lighter request than the
   * full detail, for backfilling scores on search hits.
   */
  getScore(kind: TitleKind, id: ProviderId): Promise<number | null>;
  /**
   * Every series, episode and movie change in the provider's feed since the
   * given moment — the whole catalogue's changes, not just titles we hold;
   * intersecting with our own rows is the caller's job. Deletes are
   * included. `maxPagesPerType` bounds one invocation's reads.
   */
  changedSince(
    since: Date,
    options?: { maxPagesPerType?: number }
  ): Promise<ChangedSinceResult>;
}
