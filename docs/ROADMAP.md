# Roadmap

Phases are sequential; each ends with something the owner actually uses.
Update the status column as work proceeds — this file is the cross-environment
source of truth for "where are we".

**Current status: Phase 0 complete (2026-08-10). Next: Phase 1 (metadata
provider + tracking).**

## Phase 0 — Scaffold

- [x] npm workspace layout (`apps/web`, `packages/*`, `supabase/`)
- [x] Next.js app with TypeScript strict + Radix Themes wired up
- [x] Supabase local dev (`supabase start`) + first migration (profiles)
- [x] Supabase Auth verified end-to-end, locally and in prod (email
      verification flow: /check-email page + /auth/confirm route; email
      template config in docs/DEPLOYMENT.md)
- [x] Deployed to Cloudflare Workers at stubs.tv — via GitHub Actions only
      (see docs/DEPLOYMENT.md)
- [x] CI: typecheck + lint + build on GitHub Actions

## Phase 1 — Track (MVP: daily-driver for the owner)

- [ ] Metadata schema migrations + `MetadataProvider` interface + `TvdbProvider`
- [ ] Search (lazy ingestion into Postgres)
- [ ] Series page: seasons/episodes, mark episode/season/show as seen
- [ ] Movie page: mark as seen
- [ ] Follow/unfollow series and people
- [ ] "My shows" dashboard: followed shows with unseen-episode counts
- [ ] Watch history list (edit `watched_at`, unmark)

## Phase 2 — See (analytics)

- [ ] Total watch time (all-time / per year)
- [ ] Era heatmap (decade × genre)
- [ ] Watch activity timeline
- [ ] Most-watched actors / directors / genres
- [ ] Data export (JSON download) — doubles as the GDPR export

## Phase 3 — Invite (friends & family)

- [ ] Invitation flow (comp plan)
- [ ] Account deletion self-serve (GDPR)
- [ ] Privacy policy + terms pages
- [ ] Marketing landing page with real content
- [ ] Metadata refresh cron hardened (follows-first prioritization)

## Phase 4 — Anticipate (calendar)

- [ ] In-app "upcoming" view for followed shows/people
- [ ] Tokenized per-user iCal feed (`/api/calendar/<token>.ics`)

## Phase 5 — Charge (public launch, only if 1–4 prove out)

- [ ] Stripe: Basic $1/mo · $10/yr, Pro $3/mo · $30/yr
- [ ] Entitlement checks (single helper, `profiles.plan`)
- [ ] Decide Basic/Pro feature split
- [ ] Self-hosting guide polish (community-readiness)

## Icebox (explicitly deferred)

- Migrate auth email from Mailjet to Cloudflare Email Service — when on
  Workers Paid and the service is GA (ADR-0009; SMTP credential swap)

- Rewatch tracking (relax `watches` uniqueness)
- Personal ratings surfaced in UI
- TMDB as a second metadata provider (needs their commercial license)
- Streaming availability ("where to watch")
- Social features, public profiles
- Import from Trakt/IMDb/CSV — worth considering earlier if any export of the
  owner's old watch history turns up
