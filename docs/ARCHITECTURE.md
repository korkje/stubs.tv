# Architecture

Decisions behind this design are recorded in [decisions/](decisions/). This
document describes the resulting system.

## Bird's eye view

```
                 ┌─────────────────────────────────────────┐
                 │              Cloudflare                  │
 stubs.tv ──DNS──▶  Workers: Next.js via @opennextjs/      │
                 │  cloudflare (SSR + API routes + cron)    │
                 └────────────┬────────────────────────────┘
                              │ server-side only
              ┌───────────────┼──────────────────┐
              ▼               ▼                  ▼
      ┌──────────────┐ ┌──────────────┐  ┌──────────────┐
      │  Supabase    │ │  Supabase    │  │  TheTVDB v4  │
      │  Postgres    │ │  Auth        │  │  API         │
      │  (EU region) │ │  (EU region) │  │  (ingestion) │
      └──────────────┘ └──────────────┘  └──────────────┘
```

One Next.js app (`apps/web`) serves three surfaces:

- `/` — marketing pages (static/ISR, no auth)
- `/app/…` — the webapp (auth required)
- `/admin/…` — admin surface (auth + admin role required)

They stay in one app until a concrete need splits them (would require an ADR).

## Hosting: Cloudflare Workers

- Deployed with `@opennextjs/cloudflare` (OpenNext adapter, 1.0 GA).
- On the Workers **paid** plan (ADR-0016): 30s CPU and 10,000 subrequests
  per invocation, 10 MiB gzipped bundle. Still measure bundle impact before
  adding dependencies (`npx wrangler deploy --dry-run` from `apps/web`).
- Request-path rendering stays small as policy even though the 10ms free
  cap no longer applies: pages must not render unbounded lists — the series
  page collapses seasons and renders one at a time, and per-season counts
  come from the `season_progress` SQL view rather than from reducing over
  every episode in the worker. The paid CPU budget is spent on background
  work (imports, refresh), not heavier pages.
- Cloudflare Cron Triggers drive scheduled jobs by hitting internal guarded
  routes (dispatched on the cron expression in custom-worker.ts): hourly
  metadata refresh (`/api/refresh`), and a 5-minute sweep of open import
  jobs (`/api/import/run`).
- `next/image` runs `unoptimized` (next.config, ADR-0002) — the default
  Vercel loader doesn't exist on Workers. Revisit (Cloudflare Images) only
  if poster bandwidth ever becomes a real cost.

## Data layer: Supabase (EU)

- **Postgres** is the single source of truth — both cached metadata and user
  data. Real SQL enables the analytics features (heatmaps, aggregates)
  without a separate analytics store.
- **Auth**: Supabase Auth (email + OAuth providers TBD). Sessions verified
  server-side in the Next.js app via `@supabase/ssr`.
- **RLS everywhere**: user-data tables are row-level-secured to the owning
  user; metadata tables are public-read, service-role write.
- Schema managed exclusively through migration files in `supabase/`
  (`supabase db diff` / `supabase migration new`). Local dev runs
  `supabase start` (Dockerized Postgres + Auth), so the whole stack works
  offline apart from TVDB calls.

## Metadata ingestion: the provider abstraction

TheTVDB is the only provider today, but nothing outside the ingestion layer
may know that (see ADR-0004):

- All app entities (`series`, `episodes`, `movies`, `people`, …) use
  **internal IDs**. Provider IDs live only in an `external_ids` mapping table.
- A `MetadataProvider` interface (search, getSeries, getEpisodes, getMovie,
  getPerson, changedSince) is implemented by `TvdbProvider` in
  `packages/metadata`.
- **Lazy ingestion**: when a user searches or opens a title we don't have (or
  have stale), fetch from TVDB and upsert into Postgres.
- TVDB rate limits and auth-token refresh are handled inside the provider.

Adding TMDB later = implementing the same interface + adding rows to
`external_ids`. No schema migration of user data.

**Attribution is the one deliberate exception to that rule.** TheTVDB's terms
require crediting them wherever their metadata is shown, so `SiteFooter` names
and links them from the `/app` layout — every signed-in page, which is all of
the ones that show metadata. The marketing and auth pages show none and carry
no credit. It is a fixed string in the UI rather than a leak of the provider:
no TVDB IDs, no TVDB response shapes. It stays as long as TheTVDB is a
provider, and a second provider means crediting that one too, not replacing
this.

### Cache lifecycle (planned — not built yet)

As it stands the copy only grows: search leaves a stub row for every result
it returns, opening a title stores it permanently, and nothing is ever
evicted. A 12-hour window governs whether we *refetch* an opened title, not
how long rows live. That is fine at one user and wrong at a hundred, so three
pieces are planned.

**Eviction.** Drop what nobody is using: never-opened search stubs first
(`fetched_at is null` and old), then titles no user references at all.

> Hazard for whoever builds this: `follows`, `watches` and `ratings` are
> polymorphic — `entity_id` carries no foreign key — so the database will
> *not* stop you deleting a series someone has watched, and will not cascade.
> Eviction must check those three tables explicitly. Getting this wrong
> silently destroys watch history, which is the one thing this app exists to
> protect.

**Freshness.** Partially built: the hourly cron (`/api/refresh`, ADR-0010)
sweeps followed series stalest-first, which is what keeps the up-next feed
and the calendar honest without anyone opening a page. Still planned: driving
it from TVDB's `/updates?since=` endpoint, comparing against the
`provider_updated_at` we already store so only genuinely changed records are
refetched — and widening beyond followed titles. Planned in detail in
[plans/metadata-updates.md](plans/metadata-updates.md).

**Local-first search.** Query our own tables first and render immediately,
then merge TVDB's results in — falling back to a visible notice, rather than
an error, when TVDB is unreachable.

> The merge must never reorder rows that are already on screen. Results
> arriving mid-interaction and shuffling under a finger that is already moving
> is worse than being slow. The rule: a row keeps the position it was first
> rendered at for the lifetime of that query, and late arrivals only append.
> Deduplicate against `external_ids` so a title we already hold does not
> appear twice when TVDB returns it too.

## Payments

Polar as merchant of record (ADR-0013, not the Stripe this section once
predicted): a checkout redirect route, a signature-verified webhook that
recomputes `profiles.plan`, and Polar's hosted customer portal. Entitlement
checks go through one helper (`requireWriteAccess`, ADR-0014). Self-hosted
instances skip all of it behind `SELF_HOSTED=true` (ADR-0019).

## Calendar

Shipped (ADR-0018): a per-user tokenized iCal endpoint
(`/api/calendar/<token>.ics`) generated from followed shows' upcoming
episodes, where the URL token is the credential. The in-app equivalent is
the home feed's scroll-down direction.

## Monorepo

npm workspaces (plain Node LTS — see ADR-0007):

```
apps/web/            Next.js app (marketing + app + admin)
packages/metadata/   MetadataProvider interface + TvdbProvider
packages/db/         Generated DB types, query helpers shared across packages
supabase/            config.toml, migrations/
docs/                This documentation
```

No Turborepo until there's more than one app — plain npm scripts suffice.

## Environments

- **Local**: `supabase start` + `npm run dev` (+ `.env.local` with TVDB key).
- **Production**: Cloudflare Workers + hosted Supabase (EU). Deployed
  exclusively from GitHub Actions on pushes to main — checks, then
  `supabase db push`, then the worker deploy. Runtime secrets live in
  Cloudflare (wrangler secrets), never in the repo. See
  [DEPLOYMENT.md](DEPLOYMENT.md).
- **Preview**: Workers preview deployments; pointed at a separate Supabase
  project (or local) — never at production data.
