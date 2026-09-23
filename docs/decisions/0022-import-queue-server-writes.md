# ADR-0022: The import queue is written by the server only

- Status: accepted
- Date: 2026-09-23
- Amends: ADR-0015 (whose queue tables followed the owner-only RLS pattern)

## Context

ADR-0015 persists a TV Time import as a job plus watch and film *intents*,
which a background worker materialises into `watches`. Those tables were
given the same shape as `follows` and `watches`: owner-only `for all`
policies and full DML for `authenticated`, with the phase-1 action writing
through the user's own client.

That shape suits tables holding the user's own data. It doesn't suit a
work queue that a service-role worker trusts. `commitImport` is where the
plan check (ADR-0014), the size caps and payload validation live, yet a
signed-in account could write the same rows directly through the API and
skip all three. It could also re-date its job to the front of the
oldest-first queue, reset processed rows to `pending` so the worker repeats
them, and point intents at another user's job, since foreign-key checks
ignore RLS. The worker spends provider calls and invocation time on
whatever the queue holds, so each of these lands on every other importer.

## Decision

1. **Users read their import rows; only the server writes them.**
   `authenticated` keeps `select` on `import_jobs`, `import_watch_intents`
   and `import_movie_intents` (progress bar, reconciliation report, GDPR
   export) under a select-only owner policy, and loses insert, update and
   delete.
2. **Writes go through the service role, after `requireWriteAccess()`.**
   `commitImport` persists the job and its intents; the manual film pick
   and skip update intents with an explicit `user_id` filter, which is now
   the ownership check. The worker is unchanged. Follows and ratings from
   an import are the user's own rows and still go through the authenticated
   client.
3. **An intent's job belongs to the intent's user**, enforced by a
   composite foreign key `(job_id, user_id)` → `import_jobs (id, user_id)`
   rather than by RLS.
4. **Open jobs share the worker.** Each `/api/import/run` invocation splits
   its time evenly among open jobs, oldest first (`lib/import/clock.ts`),
   instead of the oldest job using all of it.

## Consequences

- The queue only ever holds what `commitImport` validated, so the caps and
  the paywall hold for the worker too.
- The service role is used in one more place, `lib/import/actions.ts`, and
  every write there must scope by `user_id` itself because RLS no longer
  does. AGENTS.md and `lib/supabase/service.ts` list it.
- A large import no longer holds up everyone else's for whole cron ticks;
  it runs a little slower itself while others share the invocation.
- Future importers (Trakt, IMDb, CSV) inherit this: the server writes their
  jobs and intents, the client never does.
