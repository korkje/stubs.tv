# ADR-0003: Supabase for Postgres and Auth

- Status: accepted
- Date: 2026-08-10

## Context

Need a database and an auth provider. Hard requirements: never build our own
auth; good free tier; costs that scale gently (explicitly not Auth0-style
pricing); GDPR-friendly EU hosting; local runnability for self-hosters. The
owner already has Supabase experience. Analytics features (heatmaps,
aggregates) want real SQL.

Alternatives considered: Cloudflare D1 + Better Auth (one provider, but
SQLite limits analytics, and Better Auth is a run-it-yourself library —
too close to building our own auth); Neon + Clerk (excellent DX, but two
more vendors and Clerk is ~6× Supabase's per-MAU price at scale).

## Decision

Supabase, project in an EU region (Frankfurt), providing both Postgres and
Auth. Row Level Security on all user-data tables. Schema managed via
Supabase migration files; local development via `supabase start`.

## Consequences

- Free tier (500 MB DB, 50k MAU) covers phases 1–4; Pro is $25/mo; auth
  overage ~$0.00325/MAU — no pricing cliff at scale.
- Postgres unlocks the analytics roadmap without a second datastore.
- Self-hosters get a documented local stack (Supabase CLI/Docker).
- Free-tier caveat: projects pause after 1 week of inactivity — irrelevant
  once the owner uses it daily, but worth knowing during development.
- We should use Supabase as *Postgres + Auth*, not lean on every
  proprietary feature (keeps the self-host/migration story clean).
