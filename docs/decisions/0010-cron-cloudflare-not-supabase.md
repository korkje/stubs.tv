# ADR-0010: Scheduled jobs run where their code lives — Cloudflare cron for worker work

- Status: accepted
- Date: 2026-08-13

## Context

The up-next feed (and a future iCal subscription) is only as fresh as the
episode metadata, which until now refreshed only when someone opened a show
page. A background refresh job needs a scheduler. Two candidates exist in
the stack: Supabase cron (pg_cron, optionally with pg_net for HTTP) and
Cloudflare Workers cron triggers.

## Decision

Scheduled work runs on the platform where its code already lives.

Metadata refresh is TypeScript in the worker (the provider abstraction and
ingestion layer, per ADR-0004), so it is triggered by a **Cloudflare cron
trigger**: the schedule is declared in `wrangler.jsonc`, a thin custom
worker entrypoint (`custom-worker.ts`) adds a `scheduled` handler around
the OpenNext-generated fetch handler, and the handler invokes the guarded
`/api/refresh` route in-process.

Supabase cron remains the right tool for jobs that are **purely database
work** (SQL maintenance, future analytics rollups): those schedules would
live in migrations and touch no external APIs.

## Consequences

- No second implementation of ingestion (pg_net/plpgsql or a Deno edge
  function would both duplicate the provider layer and, in the Deno case,
  breach the Node-only rule).
- No cross-service invocation secret: the cron trigger fires inside the
  worker that already holds every credential the job needs. The route is
  still guarded by `CRON_SECRET` (a worker secret) because it is also
  reachable over HTTPS.
- The schedule is versioned in the repo and deployed by the same CI as the
  code it runs.
- Cron triggers do not fire in local dev; the route can be exercised with
  curl and the `CRON_SECRET` from `.env.local`.
