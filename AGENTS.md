# AGENTS.md — instructions for AI coding agents

This file is the shared entry point for every AI environment used on this
project (Claude Code, Codex, Mistral, CLI/desktop/cloud). Read it before doing
anything else; keep it and the docs it points to up to date.

## What this project is

**stubs** (stubs.tv) — a webapp for tracking watched movies and TV shows.
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
  plan — the worker bundle must stay under **3 MiB** (paid would raise it to
  10 MiB). Check bundle impact before adding dependencies.
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

## Commands (run from the repo root)

- `npm run dev` — Next.js dev server
- `npm run typecheck` / `npm run lint` / `npm run build`
- `npm run preview` — OpenNext build + local Workers preview
- Production deploys run from GitHub Actions on push to main (see
  docs/DEPLOYMENT.md) — do NOT deploy from a local machine;
  `npm run deploy` is a break-glass escape hatch only
- `npx supabase start` — local Supabase stack (needs Docker); copy the
  printed URL/anon key into `apps/web/.env.local` (see `apps/web/.env.example`)
- `npx supabase db reset` — reapply all migrations from scratch
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
  throwing; ignoring `error` makes a permission failure look like a no-op.
  Ingestion code routes every call through a `check()` helper that throws.

## Known workarounds

- `apps/web/src/middleware.ts` uses the deprecated edge middleware convention
  instead of Next 16's `proxy.ts`, because @opennextjs/cloudflare doesn't
  support Node-runtime middleware yet
  (https://github.com/opennextjs/opennextjs-cloudflare/issues/962). Rename to
  proxy.ts when that issue is fixed.

## Current status

Phase 1 slice 1 done: TheTVDB provider, metadata schema, lazy ingestion,
search, and read-only series/movie pages. Next is slice 2 (marking things as
seen, follows) — see [docs/ROADMAP.md](docs/ROADMAP.md).
