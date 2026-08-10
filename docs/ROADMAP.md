# Roadmap

Phases are sequential; each ends with something the owner actually uses.
Update the status column as work proceeds — this file is the cross-environment
source of truth for "where are we".

**Current status: Phase 0 mostly done (2026-08-10) — remaining: verify auth
against a running local Supabase, and the first real deploy to stubs.tv.**

## Phase 0 — Scaffold

- [x] npm workspace layout (`apps/web`, `packages/*`, `supabase/`)
- [x] Next.js app with TypeScript strict + Radix Themes wired up
- [x] Supabase local config + first migration (profiles) — end-to-end run
      still needs Docker up + `npx supabase start`
- [ ] Supabase Auth verified end-to-end (sign up, sign in, session in SSR) —
      code is in place (login page, server actions, middleware guard),
      needs local Supabase running to test
- [ ] Deploy walking skeleton to Cloudflare Workers at stubs.tv — OpenNext
      build + local `wrangler dev` smoke test pass; needs `wrangler login`,
      a hosted Supabase project (EU), and enabling the route in wrangler.jsonc
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

- Rewatch tracking (relax `watches` uniqueness)
- Personal ratings surfaced in UI
- TMDB as a second metadata provider (needs their commercial license)
- Streaming availability ("where to watch")
- Social features, public profiles
- Import from Trakt/IMDb/CSV — worth considering earlier if any export of the
  owner's old watch history turns up
