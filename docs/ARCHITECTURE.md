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
- Currently on the Workers **free** plan, which caps the worker bundle at
  **3 MiB gzipped** (paid raises it to 10 MiB). Check bundle impact before
  adding dependencies — this is the binding constraint today. Measure with
  `npx wrangler deploy --dry-run` from `apps/web`; it was 1.38 MiB gzipped
  as of Phase 1 slice 1.
- Upgrading to Workers Paid ($5/mo) is the trigger for two things at once:
  the larger bundle/CPU limits, and moving auth email to Cloudflare Email
  Service (ADR-0009).
- Cloudflare Cron Triggers drive scheduled jobs (metadata refresh) by hitting
  internal routes.
- `next/image` needs a custom loader (Cloudflare Images) or `unoptimized` —
  decide at scaffold time; do not ship the default Vercel loader.

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
  have stale), fetch from TVDB and upsert into Postgres. The DB is a
  write-through cache that becomes the permanent record.
- **Refresh job**: a cron route uses TVDB's "updates since" endpoint to
  refresh entities we already store, prioritizing titles that users follow.
- TVDB rate limits and auth-token refresh are handled inside the provider.

Adding TMDB later = implementing the same interface + adding rows to
`external_ids`. No schema migration of user data.

## Payments (later, Phase 5)

Stripe. Nothing in the schema should assume its absence: `profiles` carries a
`plan` field (`comp` for friends/family) from early on, entitlement checks go
through one helper.

## Calendar (later, Phase 4)

Per-user tokenized iCal endpoint (`/api/calendar/<token>.ics`) generated from
followed shows' upcoming episodes. In-app "upcoming" view ships first.

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
