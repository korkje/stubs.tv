# ADR-0016: The worker runs on the Workers Paid plan

- Status: accepted
- Date: 2026-08-19 (recording a move the owner had already made)

## Context

ADR-0002 chose Cloudflare Workers and deliberately stayed on the free plan
through early development, with named upgrade triggers: a feature that
cannot be done well inside 10ms of CPU, opening to other users, or a
workaround that stops being independently good. It also promised the
upgrade would happen "not on a date".

Both people-facing triggers have since fired — the app is live at stubs.tv
with public signups and paid plans (ADR-0014) — and the owner upgraded the
account. The docs lagged: AGENTS.md and ADR-0002 still described free-plan
limits, and the TV Time import plan (docs/plans/tvtime-import.md) sized its
batches against 50 subrequests per invocation, a ceiling that no longer
applies.

The import is also the first feature that genuinely cannot ship on the free
tier: ingesting metadata for a few hundred shows at ~30 subrequests each
against a 50-per-invocation cap makes a 200-show import take days.

## Decision

stubs.tv runs on **Workers Paid**. The limits that now govern design:

- **CPU:** 30s per invocation (raisable via `limits.cpu_ms`), not 10ms.
- **Subrequests:** 10,000 per invocation, not 50.
- **Bundle:** 10 MiB gzipped, not 3 MiB.

Two free-plan habits stay in force on their merits, not out of budget fear:

1. **Small request-path rendering.** The 10ms discipline produced better
   pages (SQL aggregation, paginated seasons). Interactive latency still
   rewards all of it; the paid CPU budget is for background work, not an
   excuse for heavy renders.
2. **Batched, resumable background jobs.** `/api/refresh` keeps its small
   hourly batch; the import worker runs under a wall-clock deadline and
   resumes from cron. Generous limits are not a licence to assume one
   invocation always finishes.

## Consequences

- The import worker ingests a whole library in one or two invocations
  instead of days of cron ticks.
- AGENTS.md now states the paid limits; sizing decisions should stop
  citing the free-plan numbers (several docs did for a while — when limits
  matter, check this ADR, not memory).
- $5/month plus usage joins the cost floor in VISION.md's arithmetic.
- Cloudflare Email Service (ADR-0009) is unblocked from the plan side;
  migrating off Mailjet remains its own decision.
