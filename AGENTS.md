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
   (`pnpm install` + `supabase start` + `pnpm dev` once scaffolded). Don't
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
- **Cloudflare Workers** hosting via `@opennextjs/cloudflare`. Mind the
  10 MiB worker bundle limit — check bundle impact before adding dependencies.
- **Supabase** (EU region) for Postgres and Auth. Row Level Security on all
  user-data tables. Schema changes go through migrations in `supabase/`.
- **TheTVDB v4** as the only metadata provider for now, behind an abstraction.
- **pnpm workspaces** monorepo.

## Conventions

- TypeScript everywhere, `strict: true`, no `any` without a comment saying why.
- Package manager is **pnpm**.
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

## Current status

Planning complete, no application code yet. Next step is Phase 0 of
[docs/ROADMAP.md](docs/ROADMAP.md): scaffolding the monorepo.
