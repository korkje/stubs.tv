# ADR-0006: pnpm monorepo with a single Next.js app

- Status: accepted
- Date: 2026-08-10

## Context

Everything should live in one repo — marketing site, webapp, admin, backend
services, database files — and be runnable locally with minimal fuss, both
for multi-environment development and for future self-hosters.

## Decision

pnpm workspaces monorepo:

```
apps/web/            One Next.js app: marketing (/), webapp (/app), admin (/admin)
packages/metadata/   MetadataProvider interface + TvdbProvider
packages/db/         Generated DB types + shared query helpers
supabase/            config.toml + migrations/
docs/                Documentation (this)
```

Marketing, webapp, and admin stay in the single Next.js app — separated by
route groups and middleware (auth for /app, admin role for /admin) — until a
concrete reason to split arises (that split would be a new ADR). No Turborepo
until there is more than one app; plain pnpm scripts are enough.

## Consequences

- `git clone` → `pnpm install` → `supabase start` → `pnpm dev` is the whole
  local story.
- One deploy target, one bundle (mind ADR-0002's 10 MiB limit — an admin
  surface heavy enough to threaten it would be the trigger to split).
- Backend "services" are Next.js API routes + Cloudflare cron triggers; no
  separate service processes to orchestrate locally.
