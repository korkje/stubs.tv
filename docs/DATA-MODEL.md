# Data model (draft)

Draft schema to be turned into Supabase migrations during Phase 1. Naming and
details will evolve; the *shape* — internal IDs, external-ID mapping,
episode-level watch records — is settled (ADR-0004).

Two halves: **metadata** (public-read, service-role write, populated from
providers) and **user data** (RLS-protected, owned by users).

## Metadata tables

```
series
  id            bigint PK (internal)
  name          text
  overview      text
  first_aired   date
  status        text            -- continuing / ended / …
  genres        text[]
  runtime_min   int             -- typical episode runtime
  poster_url    text
  fetched_at    timestamptz     -- staleness marker for refresh job

seasons
  id, series_id FK, number, name, poster_url

episodes
  id            bigint PK
  series_id     FK
  season_id     FK
  number        int
  name          text
  overview      text
  aired         date            -- drives "upcoming" + era analytics
  runtime_min   int             -- drives watch-time analytics
  fetched_at    timestamptz

movies
  id            bigint PK
  name          text
  overview      text
  released      date
  genres        text[]
  runtime_min   int
  poster_url    text
  fetched_at    timestamptz

people
  id            bigint PK
  name          text
  image_url     text
  fetched_at    timestamptz

credits                          -- person ↔ title
  person_id     FK
  series_id     FK nullable      -- exactly one of series_id/movie_id set
  movie_id      FK nullable
  role          enum: actor | director | creator | …
  character     text nullable
  PK (person_id, coalesced title, role, character)

external_ids                     -- the provider abstraction
  entity_type   enum: series | season | episode | movie | person
  entity_id     bigint
  provider      enum: tvdb       -- tmdb, imdb… can be added later
  provider_id   text
  UNIQUE (provider, entity_type, provider_id)
  UNIQUE (entity_type, entity_id, provider)
```

Rules:
- Provider IDs never appear outside `external_ids` and the ingestion code.
- `runtime_min` and air/release dates are required for analytics — ingestion
  should treat them as first-class, not optional nice-to-haves.

## User tables (all RLS: `user_id = auth.uid()`)

```
profiles
  user_id       uuid PK → auth.users
  display_name  text
  plan          enum: comp | basic | pro   -- comp = friends & family
  is_admin      boolean default false
  created_at    timestamptz

follows
  user_id       uuid FK
  entity_type   enum: series | person      -- follow shows and people
  entity_id     bigint
  created_at    timestamptz
  PK (user_id, entity_type, entity_id)

watches                          -- one row per watched episode or movie
  id            bigint PK
  user_id       uuid FK
  entity_type   enum: episode | movie
  entity_id     bigint
  watched_at    timestamptz      -- when the user watched it (editable)
  rating        smallint nullable  -- personal 1–10, optional, later
  created_at    timestamptz
  UNIQUE (user_id, entity_type, entity_id)  -- relax later if rewatch tracking is added
```

Season/series "mark all as seen" is an app-level operation that inserts one
`watches` row per episode — analytics stay uniform, partial seasons stay
representable.

## Analytics (derived, not stored)

All computed with SQL over `watches` joined to metadata:

- **Total watch time**: `SUM(runtime_min)` over watches.
- **Era heatmap**: bucket by `date_trunc('decade', aired/released)` ×
  `unnest(genres)`, count or sum runtime.
- **Activity over time**: bucket `watched_at`.
- **Per-show progress**: episodes watched vs. episodes aired.

If aggregates get slow at scale: materialized views or per-user rollup tables,
refreshed on write or on cron. Not needed for MVP.

## GDPR touchpoints

- Export = dump of the user's `profiles`, `follows`, `watches` (JSON).
- Delete = cascade delete from `auth.users` through all user tables.
- Metadata tables contain no personal data.
