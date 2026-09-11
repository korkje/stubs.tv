# ADR-0021: Self-hosting ships as a Docker image with an in-process scheduler

- Status: accepted
- Date: 2026-09-11

## Context

ADR-0019 made a self-hosted instance *usable* (`SELF_HOSTED=true` removes
the paywall), but not *runnable*: the README pointed self-hosters at
docs/DEPLOYMENT.md, which is the owner's Cloudflare Workers + GitHub
Actions pipeline. There was no container, and two pieces of the app only
existed as Cloudflare cron triggers in `wrangler.jsonc` — the hourly
metadata refresh (ADR-0010) and the five-minute import sweep (ADR-0015).
On any other host, followed shows went stale and TV Time imports never
materialised, silently.

The audience a self-hosting pitch is judged by expects `docker compose up`.

## Decision

1. **A `Dockerfile` at the repo root builds a standalone Next.js server**
   (`output: "standalone"`, tracing root = monorepo root) and runs it with
   plain `node apps/web/server.js` as the unprivileged `node` user.
   `docker-compose.yml` wraps it as one service; `.env.example` at the
   root is the compose env template. The Cloudflare build is untouched:
   OpenNext already forces the same two Next options, so setting them in
   `next.config.ts` is a no-op there.
2. **The image is built per instance, not pulled prebuilt.** Next inlines
   `NEXT_PUBLIC_*` values at build time and the prerendered marketing
   pages read `SELF_HOSTED` at build time, so those three arrive as build
   args from `.env`. Accepted for now; see Consequences.
3. **Scheduled jobs run in-process behind `INTERNAL_CRON=true`.**
   `src/instrumentation.ts` (Next's boot hook, Node runtime only) starts
   two timers mirroring `wrangler.jsonc`'s schedule, each calling the same
   guarded route on the local port with the `CRON_SECRET` header — the
   exact request `custom-worker.ts` makes. This keeps ADR-0010's rule
   ("scheduled work runs where its code lives") and adds no second
   implementation of anything. Compose sets the flag; the Cloudflare
   deploy never does.
4. **Supabase stays the database and auth**, hosted or self-hosted — the
   app talks to it over its public API either way, and self-hosting
   Supabase is Supabase's own documented path. Replacing it is out of
   scope; ADR-0003 stands.

Alternatives rejected: a cron sidecar container (a second service for two
`curl` lines, and the first thing a `docker compose up` user has to
understand), a cron library (the routes are already batched, resumable and
idempotent by policy, so a dumb interval is enough), and inferring the
scheduler from `SELF_HOSTED` (someone self-hosting *on* Workers has real
cron triggers and no long-lived timers — the two flags are orthogonal).

## Consequences

- `docker compose up -d --build` with a filled-in `.env` is a complete
  instance; docs/SELF-HOSTING.md is the walkthrough and is the page the
  README's self-hosting section now links.
- Production stubs.tv is unaffected: no flag set, OpenNext build unchanged.
  Verify with `npx wrangler deploy --dry-run` after touching
  `next.config.ts`.
- Two things `request.url` hid on Workers surfaced on Node and are fixed
  here: the standalone server fills `request.url` with its listen address
  (`http://0.0.0.0:3000`), so route handlers now build absolute redirects
  from `lib/request-origin.ts` (forwarded headers, then Host) — a reverse
  proxy should pass `X-Forwarded-Host`/`X-Forwarded-Proto` as usual; and
  the import kick, which carries `CRON_SECRET`, targets loopback under
  `INTERNAL_CRON` instead of the client-controlled Host header.
- `INTERNAL_CRON=true` also works in `next dev`, which gives local dev the
  scheduled jobs ADR-0010 said it lacked.
- **Follow-up worth doing before publishing a prebuilt image**: the
  browser never uses the Supabase client (`lib/supabase/client.ts` has no
  importers), so `NEXT_PUBLIC_SUPABASE_URL`/`_ANON_KEY` could be renamed to
  plain runtime env and `SELF_HOSTED` moved off the prerendered pages. Then
  one image on GHCR would serve every instance. Not done now because the
  names are wired through CI variables, wrangler vars and every doc.
