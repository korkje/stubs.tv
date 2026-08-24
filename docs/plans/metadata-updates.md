# Plan: delta-driven metadata refresh via TVDB /updates

Status: **shipped 2026-08-24**, same day as the plan. Kept for the endpoint
notes and the merge/delete reasoning. What was built deviates from the
design below in one load-bearing way: the sync **only invalidates**
(`fetched_at = null`) instead of refetching — the existing sweep
(nulls-first, same invocation) and the on-open path do all refetching, so
the sync stays cheap no matter how noisy the feed is, and no `force`
plumbing was needed. Other deviations: cursor advances to run-start even on
a page-budget miss, with a blanket invalidation of followed series as the
remedy (a never-advancing cursor could death-spiral; a too-eager one just
degrades to the pre-sync 12h window) — and cursor *initialization* gets the
same blanket remedy, since "no cursor yet" is the same unknown-history
state; that is also what heals the pre-sync backlog on first deploy, with
no manual steps; deletes stamp `fetched_at = now` so a
vanished title cannot jam the sweep (that bug existed in
`ensureSeriesIngested` and is fixed); both-sides-held merges are logged for
a human, not automated. Implementation: `changedSince` in
`packages/metadata`, `apps/web/src/lib/metadata/sync.ts`, the `sync_state`
migration, and the delete-then-insert episode-mapping fix in `ingest.ts`
(the two-unique-constraint poison described below in "The trap").
Live-probed 2026-08-24: type spellings series/movies/episodes, 500/page,
`seriesId` on ~70% of episode records, deletes present without an `action`
filter, 30-day lookback accepted.

## Why

Today's refresh is blind polling: the hourly cron (`/api/refresh`) picks
the two stalest **followed** series and refetches them wholesale, changed
or not. Three consequences:

- Movies and unfollowed titles are **never** refreshed — a movie's release
  date is whatever it was the day someone first opened it.
- Almost every refetch is wasted work: most shows change rarely, and we
  re-download full episode lists to discover nothing changed.
- Freshness scales with catalogue size: at BATCH=2 hourly, a catalogue of
  N followed shows cycles in N/2 hours. Fine at ten shows, a day-stale lie
  at fifty.

TheTVDB's own docs (github.com/thetvdb/v4-api) endorse exactly our
architecture — keep your own database copy rather than proxying per
request — and name the missing half: "Monitor the /updates endpoint and
update your database with any changes to the records." This plan is that
half.

## The endpoint

`GET /updates?since=<unix timestamp>`, optional `type` (series, episodes,
movies, people, artwork, …) and `action` (update | delete) filters,
paginated via the standard `links` object. Each record carries
`recordType`/`entityType`, `recordId`, `method` (created | updated |
deleted; `methodInt` 1/2/3), `timeStamp`, and — for duplicate-record
merges — `mergeToId` + `mergeToEntityType`.

## What already exists (do not rebuild)

- **`provider_updated_at`** is stored on ingested rows (migration
  `20260810120000_metadata.sql`), so "is this update newer than what we
  hold" is answerable locally.
- **`external_ids`** maps provider ids → internal ids; "which of these
  changed records do we even hold" is one `in (...)` query.
- **429 backoff** in `TvdbClient` (built for the TV Time import) and the
  cron plumbing: `CRON_SECRET` guard, hourly trigger in custom-worker.ts.
- **The batched-and-resumable policy** (AGENTS.md): never trust one
  invocation to finish. The import worker (`/api/import/run`) is the
  reference implementation of a cursor-driven resumable job.

## Design

1. **Provider interface** grows the method ARCHITECTURE.md already names:
   `changedSince(since: Date): Promise<ProviderChange[]>` where a change is
   `{ entityType, providerId, method, timeStamp, mergeTo? }`. Pagination is
   handled inside the provider (it is a TVDB detail); the caller may pass a
   page/record budget so one invocation stays bounded.
2. **A cursor, stored in the database** — a `sync_state` table (one row per
   provider) holding the last fully processed `timeStamp`. Not an env var,
   not in-memory: the worker is stateless and invocations must resume.
   *Grants gotcha applies* (AGENTS.md): the table needs explicit
   `grant … to service_role`, and no anon/authenticated access at all.
3. **The cron flow** (extend `/api/refresh`, or a sibling route on the same
   trigger):
   - read cursor → `changedSince(cursor)` → intersect with `external_ids`
     to changed-ids-we-hold → refetch **only those** through the existing
     `ensure*Ingested` paths → advance the cursor to the `timeStamp` of the
     last record actually processed (not "now" — that would drop records
     seen mid-run).
   - Episode updates carry `seriesId`: collapse them to their series and
     refresh via the existing series/episodes path rather than teaching
     ingestion to patch single episodes.
   - Bound the work per invocation (records/pages budget); leftover pages
     are picked up next hour because the cursor only advanced as far as
     what was processed. Batched and resumable, per policy.
4. **First run**: initialise the cursor to *now* and let the existing sweep
   handle the backlog — do not attempt a historical replay through
   /updates (unbounded, and the sweep already converges the catalogue).
5. **Keep the stalest-first sweep as a safety net**, demoted (e.g. BATCH=1,
   or every few hours): it catches anything /updates missed — a dropped
   invocation past the cursor, TVDB-side gaps — and is what heals the
   catalogue if the cursor logic ever has a bug. Two imperfect mechanisms
   that cover each other beat one perfect one we have to trust.

## The trap: deletes and merges touch watch history

This is the same polymorphic-reference hazard ARCHITECTURE.md flags for
eviction, arriving through a new door. `follows`, `watches` and `ratings`
carry no FK — the database will not stop a delete and will not cascade.

- **`method = deleted`**: never hard-delete a title any user references.
  Watch history is the thing this app exists to protect; a TVDB dedup or
  vandalism-revert must not erase it. Safe minimum: stop refreshing the
  row (it can never change again) and leave it. Actual removal belongs to
  the eviction feature, which must check the three user tables explicitly.
- **`mergeToId`**: provider record X merged into Y. If we don't hold Y:
  repoint X's `external_ids` row to Y and refetch — internal id, and every
  user row hanging off it, survives untouched. If we hold **both**: two
  internal entities must become one — move follows/watches/ratings from
  the loser to the survivor (mind the unique constraints: a user may have
  rows on both; `on conflict do nothing`), repoint/delete the loser's
  `external_ids`, then delete the loser row. Do this in one transaction —
  a SQL function, in the spirit of ADR-0017's `export_user_data()`.
  Episode-level merges are the fiddly case (same show, reordered
  episodes); if the first implementation only handles series/movie merges
  and logs episode merges for manual review, say so in the route's
  response so the log is visible.

## Scope limits

- `type`-filter to what we hold: series, episodes, movies (people once
  slice 4 ingests them). Artwork/awards/etc. records are noise for us.
- No schema change to user tables; only `sync_state` is new.
- This plan is freshness only — eviction and local-first search (the other
  two Cache-lifecycle pieces) stay separate work.

## Open questions (decide when building)

- Whether `/updates` has a maximum look-back window for `since` — the spec
  doesn't say. If it does, a cursor older than the window must fall back
  to the sweep rather than silently missing changes; probe on staging
  before relying on long gaps (e.g. after a paused deploy).
- Whether to fold this into `/api/refresh` or run it as a sibling route —
  same trigger either way; separate routes keep the budget accounting
  simpler.
