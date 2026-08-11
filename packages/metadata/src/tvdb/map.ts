import type {
  EpisodeDetail,
  MovieDetail,
  SearchResult,
  SeriesDetail,
  TitleKind,
} from "../types";
import type {
  TvdbEpisode,
  TvdbMovieExtended,
  TvdbSearchResult,
  TvdbSeriesExtended,
  TvdbTranslation,
} from "./dto";

const ARTWORK_HOST = "https://artworks.thetvdb.com";

/**
 * TheTVDB returns records in their original language: Spirited Away comes
 * back as 千と千尋の神隠し, with the English title alongside in a translations
 * map. This app is English, so prefer that everywhere.
 *
 * (If stubs is ever localised, this is the single place that decides.)
 */
const LANGUAGE = "eng";

/** Picks the English entry out of the translations array on entity endpoints. */
function translated(
  entries: TvdbTranslation[] | undefined,
  field: "name" | "overview"
): string | null {
  const list = entries ?? [];
  const preferred = list.find((entry) => entry.language === LANGUAGE);
  return text(preferred?.[field]);
}

/** TheTVDB uses "" and whitespace where it means "no value". */
function text(value: string | undefined | null): string | null {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}

/** Dates arrive as YYYY-MM-DD, but "" and "0000-00-00" both occur. */
function date(value: string | undefined | null): string | null {
  const trimmed = text(value);
  if (!trimmed || trimmed.startsWith("0000")) return null;
  return trimmed;
}

function image(value: string | undefined | null): string | null {
  const trimmed = text(value);
  if (!trimmed) return null;
  return trimmed.startsWith("http") ? trimmed : `${ARTWORK_HOST}${trimmed}`;
}

function year(value: string | undefined | null): number | null {
  const parsed = Number.parseInt(value ?? "", 10);
  return Number.isFinite(parsed) ? parsed : null;
}

/** Runtimes of 0 mean "unknown" rather than "instantaneous". */
function runtime(value: number | undefined | null): number | null {
  return typeof value === "number" && value > 0 ? value : null;
}

/** "2021-04-20 01:36:20" (UTC, no zone marker) → ISO 8601. */
function timestamp(value: string | undefined | null): string | null {
  const trimmed = text(value);
  if (!trimmed) return null;
  const parsed = new Date(`${trimmed.replace(" ", "T")}Z`);
  return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString();
}

function genres(values: { name?: string }[] | undefined): string[] {
  return (values ?? []).map((g) => text(g.name)).filter((g): g is string => g !== null);
}

export function mapSearchResult(raw: TvdbSearchResult): SearchResult | null {
  const providerId = text(raw.tvdb_id);
  const name = text(raw.name);
  const kind = raw.type as TitleKind | undefined;

  if (!providerId || !name || (kind !== "series" && kind !== "movie")) return null;

  // Search results carry translations as plain language → value maps, unlike
  // the arrays the entity endpoints use.
  return {
    kind,
    providerId,
    name: text(raw.translations?.[LANGUAGE]) ?? name,
    year: year(raw.year) ?? year(raw.first_air_time?.slice(0, 4)),
    overview: text(raw.overviews?.[LANGUAGE]) ?? text(raw.overview),
    posterUrl: image(raw.image_url),
  };
}

export function mapSeries(raw: TvdbSeriesExtended): SeriesDetail {
  return {
    providerId: String(raw.id),
    name:
      translated(raw.translations?.nameTranslations, "name") ??
      text(raw.name) ??
      "Untitled",
    overview:
      translated(raw.translations?.overviewTranslations, "overview") ??
      text(raw.overview),
    firstAired: date(raw.firstAired),
    status: text(raw.status?.name),
    genres: genres(raw.genres),
    runtimeMin: runtime(raw.averageRuntime),
    posterUrl: image(raw.image),
    providerUpdatedAt: timestamp(raw.lastUpdated),
    // The seasons array mixes ordering schemes (aired/DVD/absolute), which
    // would collide on (series, number) — keep only the canonical one.
    seasons: (raw.seasons ?? [])
      .filter((s) => s.type?.type === "official" && typeof s.number === "number")
      .map((s) => ({
        number: s.number as number,
        name: text(s.name),
        posterUrl: image(s.image),
      }))
      .sort((a, b) => a.number - b.number),
  };
}

export function mapEpisode(raw: TvdbEpisode): EpisodeDetail | null {
  if (typeof raw.number !== "number" || typeof raw.seasonNumber !== "number") {
    return null;
  }

  return {
    providerId: String(raw.id),
    seasonNumber: raw.seasonNumber,
    number: raw.number,
    name: text(raw.name),
    overview: text(raw.overview),
    aired: date(raw.aired),
    runtimeMin: runtime(raw.runtime),
    imageUrl: image(raw.image),
    providerUpdatedAt: timestamp(raw.lastUpdated),
  };
}

export function mapMovie(raw: TvdbMovieExtended): MovieDetail {
  const globalRelease =
    raw.first_release?.date ??
    raw.releases?.find((r) => r.country === "global")?.date ??
    raw.releases?.[0]?.date;

  // Unlike series, the movie endpoint carries no top-level overview at all;
  // it exists only per language under translations.
  const overviews = raw.translations?.overviewTranslations ?? [];
  const overview =
    translated(overviews, "overview") ??
    text(raw.overview) ??
    text(overviews.find((t) => t.isPrimary)?.overview);

  return {
    providerId: String(raw.id),
    name:
      translated(raw.translations?.nameTranslations, "name") ??
      text(raw.name) ??
      "Untitled",
    overview,
    released: date(globalRelease),
    genres: genres(raw.genres),
    runtimeMin: runtime(raw.runtime),
    posterUrl: image(raw.image),
    providerUpdatedAt: timestamp(raw.lastUpdated),
  };
}
