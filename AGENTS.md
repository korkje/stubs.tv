# AGENTS.md — instructions for AI coding agents

This file is the shared entry point for every AI environment used on this
project (Claude Code, Codex, Mistral, CLI/desktop/cloud). Read it before doing
anything else; keep it and the docs it points to up to date.

## What this project is

**stubs.tv** — a webapp for tracking watched movies and TV shows. The
domain is the brand ("always stubs.tv", see docs/VISION.md — Name).
Search titles, follow shows/actors/directors, mark episodes/seasons/movies as
seen, and view watch-history analytics. See [docs/VISION.md](docs/VISION.md).

## Ground rules

1. **Documentation is load-bearing.** The owner works on this from multiple
   agent environments. Any plan, decision, or convention that isn't written
   into the repo is lost. When you make or change an architectural decision,
   add or update an ADR in `docs/decisions/` in the same change.
2. **Don't relitigate decided things.** The ADRs in `docs/decisions/` are
   settled unless the owner explicitly reopens one. Read them before proposing
   stack changes.
3. **Everything must scale without rearchitecting.** Prefer choices that work
   at 10 users and 100k users. No tech that requires a rewrite to grow.
4. **Self-hosting is a feature.** The repo must stay runnable locally
   (`npm install` + `supabase start` + `npm run dev` once scaffolded). Don't
   introduce dependencies on services that can't be substituted or mocked
   locally without documenting the escape hatch.
5. **Privacy by design.** EU-based users, GDPR applies. Store minimal PII,
   keep user data exportable and deletable. See [docs/PRIVACY.md](docs/PRIVACY.md).
6. **Metadata goes through the provider abstraction.** Never leak TVDB IDs or
   TVDB API shapes outside the ingestion layer; everything downstream uses our
   internal IDs. See ADR-0004 and [docs/DATA-MODEL.md](docs/DATA-MODEL.md).

## Stack (decided — ADRs in docs/decisions/)

- **Next.js** (App Router, TypeScript strict), single app in `apps/web` that
  serves marketing pages, the webapp, and admin routes.
- **Radix UI Themes** for all UI. Use its components and tokens before
  reaching for custom CSS; do not add another component library.
  Light/dark/system is handled by `next-themes`, which puts a `dark` class on
  `<html>` for Radix's dark palette to key off — so the root `<Theme>` must
  keep its default `appearance="inherit"`. Setting `appearance` explicitly
  pins the app to one mode and silently breaks the switcher.
- **Cloudflare Workers** hosting via `@opennextjs/cloudflare`, on the **free**
  plan, which imposes two hard limits:
  - **10ms of CPU per request** (paid: 30s). This is the tight one. Rendering
    is CPU: a page that renders hundreds of rows will return HTTP 1102
    "Worker exceeded CPU time limit" in production while working fine
    locally. Keep per-request rendering small — paginate, collapse, or move
    aggregation into SQL. Remember that every server action calling
    `revalidatePath` re-renders the whole route.
  - **3 MiB gzipped bundle** (paid: 10 MiB). Check impact before adding
    dependencies; measure with `npx wrangler deploy --dry-run`.
- **Supabase** (EU region) for Postgres and Auth. Row Level Security on all
  user-data tables. Schema changes go through migrations in `supabase/`.
- **TheTVDB v4** as the only metadata provider for now, behind an abstraction.
- **Node (LTS) + npm workspaces** monorepo — no pnpm, no Deno- or
  Bun-specific files.
- **`packages/metadata`** holds the provider abstraction and TheTVDB client
  and must never import Supabase; **`packages/db`** holds generated schema
  types. Ingestion (the only code using the service-role key) lives in
  `apps/web/src/lib/metadata/`.

## Conventions

- TypeScript everywhere, `strict: true`, no `any` without a comment saying why.
- Package manager is **npm**; tasks are plain `package.json` scripts.
- Database schema changes are Supabase migration files — never applied by hand.
- Dates/times in UTC in the database; convert at the edge for display.
- Keep the marketing site, app, and admin in `apps/web` until there's a
  concrete reason to split (that reason becomes an ADR).

## Doc map

- [docs/VISION.md](docs/VISION.md) — product, users, monetization
- [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) — system design and data flow
- [docs/DATA-MODEL.md](docs/DATA-MODEL.md) — schema draft
- [docs/ROADMAP.md](docs/ROADMAP.md) — phases and current status
- [docs/PRIVACY.md](docs/PRIVACY.md) — GDPR strategy
- [docs/decisions/](docs/decisions/) — ADRs
- [docs/plans/](docs/plans/) — specs for work that is planned but not
  started, written to be picked up cold

## Commands (run from the repo root)

- `npm run dev` — Next.js dev server
- `npm run typecheck` / `npm run lint` / `npm run build`
- `npm run preview` — OpenNext build + local Workers preview
- Production deploys run from GitHub Actions on push to main (see
  docs/DEPLOYMENT.md) — do NOT deploy from a local machine;
  `npm run deploy` is a break-glass escape hatch only
- `npx supabase start` — local Supabase stack (needs Docker); copy the
  printed URL/anon key into `apps/web/.env.local` (see `apps/web/.env.example`)
- `npx supabase db reset` — reapply all migrations from scratch, then run
  `supabase/seed.sql`, which mints the local dev account
  (dev@stubs.local / password). Invite-only signup leaves a fresh database
  with no way in — no user means no invite, no invite means no user — so
  that seed is how you get signed in locally. Local only: never
  `db reset --linked`.
- `npm run db:types` — regenerate `@stubs/db` types after a migration
  (requires local Supabase running); commit the result

## Database gotchas (learned the hard way)

- **Always grant explicitly in migrations.** This project's Postgres grants
  anon/authenticated/service_role *no* table privileges by default — only
  REFERENCES/TRIGGER/TRUNCATE. An RLS `select` policy with no matching
  `grant select` silently returns nothing, and `service_role` cannot write at
  all without `grant … to service_role`, despite bypassing RLS. Every new
  table needs both its policies and its grants.
- **`revoke execute … from public`, not from anon/authenticated.** PUBLIC
  holds EXECUTE on new functions and those roles inherit it, so revoking from
  them alone is a no-op. Remember to re-grant to `service_role` afterwards.
- **Check Postgrest errors.** supabase-js returns `{ data, error }` instead of
  throwing; ignoring `error` makes a permission failure look like a no-op —
  or, on a read, like an empty result (an unapplied migration once spent a
  debugging session disguised as "No shows match these filters"). The
  convention: every query checks `error` and **throws** with a message naming
  what failed. Ingestion routes writes through its `check()` helper; server
  components throw inline and land on the route-group error boundary
  (`app/app/error.tsx`), which shows the digest that ties a user report to
  the worker's logs.

## Measuring things locally

- **Never run `next build` or a second `next start` while the dev server is
  up.** They all share `apps/web/.next`, and rebuilding underneath a running
  server makes it serve 503s for RSC payloads — which looks exactly like an
  application bug. Stop the dev server first, or accept that any measurement
  taken that way is worthless.
- Client-side navigation behaviour (prefetching, the router cache) differs
  substantially between `next dev` and a production build. Never conclude
  anything about caching from dev.

## Known workarounds

- `apps/web/src/middleware.ts` uses the deprecated edge middleware convention
  instead of Next 16's `proxy.ts`, because @opennextjs/cloudflare doesn't
  support Node-runtime middleware yet
  (https://github.com/opennextjs/opennextjs-cloudflare/issues/962). Rename to
  proxy.ts when that issue is fixed.

## Next up

A list of unwatched episodes of followed shows in air-date order — see
"Slice 3" in [docs/ROADMAP.md](docs/ROADMAP.md). It is the owner's main reason
for the app, and it depends on the metadata refresh cron that does not exist
yet; read the note there before starting.

## Current status

Live at stubs.tv. Search, follows, ratings, and marking episodes, seasons,
shows and movies as seen all work, on phone and desktop. Metadata comes from
TheTVDB behind the provider abstraction, cached in Postgres.

Known gaps, all recorded in [docs/ROADMAP.md](docs/ROADMAP.md): nothing
refreshes cached metadata, ingestion runs inside the request path (large shows
risk the 10ms CPU ceiling in production), and a watched date is stored but
surfaced nowhere.
