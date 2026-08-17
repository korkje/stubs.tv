# Roadmap

Phases are sequential; each ends with something the owner actually uses.
Update the status column as work proceeds — this file is the cross-environment
source of truth for "where are we".

**Current status: Phase 1 in progress (2026-08-10). Slice 1 — metadata
pipeline, search and read-only title pages — is done; slice 2 is tracking
(follows and watches).**

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

**Slice 1 — metadata pipeline (done)**

- [x] Metadata schema migrations + `MetadataProvider` interface + `TvdbProvider`
- [x] Generated database types (`@stubs/db`)
- [x] Search with lazy ingestion: results become stub rows so links carry
      internal IDs, and a title is fully fetched when first opened — or when
      it is followed or marked seen, which is the other way a stub can enter
      the library without its page ever being visited
- [x] Series page: seasons and episodes, runtime totals
- [x] Movie page

**Slice 2 — tracking (next)**

- [ ] Return-to-destination after sign-in: the auth guard currently redirects
      to `/login` and drops the intended path (and leaks the original query
      string, e.g. `/login?q=wire`) — pass a `next` param and honour it

- [x] Mark episode/season/show as seen; mark movie as seen (specials
      included in bulk marks; single episodes always individually togglable;
      unaired episodes excluded from bulk marks so they still surface later)
- [x] Rate anything, 1–10, in its own `ratings` table (feeds the
      recommendation ideas in VISION.md)
- [x] Follow/unfollow series
- [x] Home page with **Shows** and **Movies** tabs (link-based, so only the
      open tab is queried and rendered)
- [x] Shows tab: followed shows with unseen-episode counts
- [ ] Watch history list (edit `watched_at`, unmark) — the place to fix
      timezone display: dates currently render from UTC, so a late-evening
      view can show the previous day

**Slice 3 — what to watch next (do this one first)**

The owner's own reason for the app: knowing what is out and not yet seen.
Everything up to here records the past; this is the part that is useful daily,
and it is the list tvchecker was actually used for. Starts as a list, becomes
the calendar in Phase 4.

- [ ] Unwatched episodes of followed shows in air-date order. Two groups from
      one query: **already aired and unseen** (catch up) and **still to come**
      (what is next). Exclude specials by default, as progress counts do.
- [ ] Each row marks as seen in place, so the list is the daily driver rather
      than a signpost to the series page.

> **This feature is only as good as the freshness of the data, and freshness
> is not built yet.** Right now a show's episodes are only refetched when
> someone opens its page and the 12-hour window has lapsed — so a new episode
> of a followed show may never appear at all. The `/updates?since=` cron in
> ARCHITECTURE.md "Cache lifecycle" is a prerequisite, not a nicety: without
> it the list quietly lies about what is coming. Prioritising followed shows
> in that job is what makes it cheap.

Shape it in SQL, like `series_progress` and `season_progress`: a
security_invoker view over follows → episodes → watches, filtered to
unwatched and ordered by air date. Bound the row count — this is a request
path, and the CPU budget is 10ms.

**Slice 4 — people**

- [ ] Ingest cast into `people`/`credits`; person pages
- [ ] Follow/unfollow actors and directors (series credits expose actors
      only — check movie credits for directors)

## Phase 2 — See (analytics)

- [ ] Total watch time (all-time / per year)
- [ ] Era heatmap (decade × genre)
- [ ] Watch activity timeline
- [ ] Most-watched actors / directors / genres
- [ ] Data export (JSON download) — doubles as the GDPR export

## Phase 3 — Open signups (was: invites)

- [x] ~~Invitation flow (comp plan)~~ Built, then removed with ADR-0014:
      signups are public, new accounts start read-only and pick a plan
- [ ] Account deletion self-serve (GDPR — privacy page promises email
      handling until this ships)
- [x] Privacy policy + terms pages
- [x] Marketing landing page with real content
- [ ] Metadata cache lifecycle — see ARCHITECTURE.md "Cache lifecycle":
      evict unused titles (minding the polymorphic-reference hazard), refresh
      what is used via `/updates?since=`, and make search local-first with a
      merge that never reorders rows already on screen

## Phase 4 — Anticipate (calendar)

Shipped early (2026-08-12): Home is an "up next" feed — unwatched episodes
of followed shows in release order, bidirectional infinite scroll centered
on today; the Shows/Movies lists live under /app/library. Filtering the
feed is still to come.

- [x] Hourly metadata refresh for followed shows (ADR-0010) — the feed and
      any calendar are only as fresh as the ingested air dates
- [ ] In-app "upcoming" view for followed shows/people
- [ ] Tokenized per-user iCal feed — planned in detail in
      [docs/plans/ical-feed.md](plans/ical-feed.md), ready to pick up

## Phase 5 — Charge (public launch, only if 1–4 prove out)

- [ ] Stripe: Basic $1/mo · $10/yr, Pro $3/mo · $30/yr
- [ ] Entitlement checks (single helper, `profiles.plan`)
- [ ] Decide Basic/Pro feature split
- [ ] Self-hosting guide polish (community-readiness)

## Icebox (explicitly deferred)



- Batch `resolve_entities()` for search — a search currently spends one RPC
  per result (~25 subrequests against the free plan's 50-per-request cap).
  A single jsonb-array function would cut it to a handful and speed search up.

- Migrate auth email from Mailjet to Cloudflare Email Service — when on
  Workers Paid and the service is GA (ADR-0009; SMTP credential swap)

- Rewatch tracking (relax `watches` uniqueness)
- Personal ratings surfaced in UI
- TMDB as a second metadata provider (needs their commercial license)
- Streaming availability ("where to watch") — **not obtainable from TheTVDB**:
  it exposes the broadcast network (`originalNetwork`, e.g. HBO) but no
  per-country streaming data, and has no availability endpoint. Real data
  means JustWatch, either directly or through TMDB's watch-providers endpoint,
  both of which carry attribution terms and commercial licensing questions
  (the same reason ADR-0004 kept us on one provider). Showing the network is
  free and could land any time; "where to stream" is a licensing decision
- Watched-date precision: decade/year/month, not just exact-or-unknown
  (see DATA-MODEL.md)
- Social features, public profiles
- Import from Trakt/IMDb/CSV — worth considering earlier if any export of the
  owner's old watch history turns up
