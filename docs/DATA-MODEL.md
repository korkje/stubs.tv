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
  score         bigint          -- provider popularity; ranks search results
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
  score         bigint          -- provider popularity; ranks search results
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
  plan          enum: comp | free | paid   -- comp = friends & family, full
                                           -- features; free = restricted
                                           -- (lapsed/public); paid = via Polar
  is_admin      boolean default false
  timezone      text                       -- IANA; where "Today" falls (null = UTC)
  specials      text: hidden|uncounted|counted  -- see Settings in the app
  bulk_mark_specials boolean default true  -- "Mark show" touches specials
  synopsis_mode text: show|scramble|hide   -- spoiler protection, unwatched only
  created_at    timestamptz

billing                          -- one row per user who ever checked out in
                                 -- Polar (ADR-0013); comp users have none.
                                 -- Written only by the webhook handler
                                 -- (service role), which recomputes
                                 -- profiles.plan from it: lifetime or an
                                 -- active subscription -> paid, else free
  user_id       uuid PK → auth.users
  polar_customer_id text unique
  lifetime      boolean default false      -- survives subscription lapses
  subscription_status text                 -- active | trialing | null
  current_period_end timestamptz
  updated_at    timestamptz

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
  created_at    timestamptz
  UNIQUE (user_id, entity_type, entity_id)

ratings                          -- deliberately separate from watches
  user_id       uuid FK
  entity_type   enum: series | season | episode | movie
  entity_id     bigint
  score         smallint         -- 1–10
  created_at    timestamptz
  updated_at    timestamptz
  PK (user_id, entity_type, entity_id)

invites                          -- signup gating (see below)
  code          uuid PK
  created_by    uuid FK → auth.users
  created_at    timestamptz
  redeemed_by   uuid FK nullable
  redeemed_at   timestamptz nullable
```

## Signup policy

`app_settings` is a single-row table (`open_signups` boolean,
`invite_allowance` int) edited from the Supabase dashboard — the admin UI
for now. While `open_signups` is false, a trigger on `auth.users` rejects
any signup that does not carry a valid unredeemed invite code in its user
metadata; redemption happens atomically in the same trigger. Users mint
invites with the `create_invite()` function (spends one of the allowance,
admins uncapped); `signup_gate()` gives the signup form a friendly verdict
first, since GoTrue flattens trigger errors into a generic message.

Invited accounts default to `plan = 'comp'`, so people invited by the owner
stay free even after payments launch — flipping `open_signups` on is the
switch for paid public signup.

**Why ratings are not a column on `watches`.** A rating belongs to the *thing*,
not to a particular viewing of it: people want to rate a whole show without
ticking off every episode, and a rewatch must not imply a second, separate
score. Keeping them apart also means ratings survive the rewatch change below
untouched, and any granularity (episode, season, show, film) works the same way.
Ratings feed the recommendation ideas in VISION.md, so the scale is numeric
(1–10) rather than thumbs — more signal for later, and it can always be
*displayed* as stars.

**Date precision is a known gap.** `watched_at` is currently either an exact
timestamp or null ("seen, date unknown"). Backfilling is the normal case, not
the exception, and people often remember roughly when — "the 90s", "2011",
"March 2019". Supporting that means storing a precision alongside the date
(`unknown | decade | year | month | day`) and rendering to match, which also
lets the activity analytics widen a backfilled entry across its range instead
of pretending it happened at midnight on the 1st. Deliberately postponed: null
covers the honest case today, and adding a `watched_precision` column later
needs no rewrite of what exists.

**Rewatch is deferred, not designed out.** The unique constraint makes
"mark as seen" idempotent, which matters for a toggle that can be
double-clicked. Supporting rewatches later means dropping that constraint and
distinguishing rows (e.g. a `watch_number`); nothing above needs to change, and
ratings are unaffected because they live in their own table.

**Marking in bulk.** Season and series "mark all as seen" are app-level
operations that insert one `watches` row per episode, so analytics stay uniform
and partly-watched seasons remain representable. Specials (season 0) are
included when marking a whole show or when marking the specials group itself —
they are episodes like any other. Individual episodes must always be
mark/unmark-able on their own; bulk actions are a convenience, never the only
way in.

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

- Export = dump of the user's `profiles`, `follows`, `watches`, `ratings`,
  `invites` (JSON).
- Delete = cascade delete from `auth.users` through all user tables.
- Metadata tables contain no personal data.
