# Roadmap

Phases are sequential; each ends with something the owner actually uses.
Update the status column as work proceeds — this file is the cross-environment
source of truth for "where are we".

**Current status (2026-08-24): live at stubs.tv with tracking, the up-next
feed, filtering, TV Time import, the iCal feed, and GDPR self-serve all
shipped. Active work: going public on GitHub
([plans/going-public.md](plans/going-public.md)). Biggest feature gaps:
people (Phase 1 slice 4), analytics (Phase 2), and the metadata cache
lifecycle.**

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

**Slice 3 — what to watch next (shipped)**

The owner's own reason for the app: knowing what is out and not yet seen.
Everything up to here records the past; this is the part that is useful daily,
and it is the list tvchecker was actually used for.

- [x] Shipped 2026-08-12 as the home page itself: unwatched episodes of
      followed shows in release order, bidirectional infinite scroll centered
      on today — past scrolls up (catch up), future scrolls down (what is
      next). Filtering followed 2026-08-14
      ([plans/library-feed-filtering.md](plans/library-feed-filtering.md)).
- [x] Each row marks as seen in place, so the list is the daily driver rather
      than a signpost to the series page.
- [x] Freshness: the hourly cron (`/api/refresh`, ADR-0010) sweeps followed
      shows stalest-first, so new episodes appear without anyone opening the
      series page. The `/updates?since=`-driven refinement remains open —
      planned in [plans/metadata-updates.md](plans/metadata-updates.md).

**Slice 4 — people**

- [ ] Ingest cast into `people`/`credits`; person pages
- [ ] Follow/unfollow actors and directors (series credits expose actors
      only — check movie credits for directors)

## Phase 2 — See (analytics)

- [ ] Total watch time (all-time / per year)
- [ ] Era heatmap (decade × genre)
- [ ] Watch activity timeline
- [ ] Most-watched actors / directors / genres
- [x] Data export (JSON download) — doubles as the GDPR export. Shipped
      2026-08-20 (ADR-0017): Settings → Account → "Download my data"

## Phase 3 — Open signups (was: invites)

- [x] ~~Invitation flow (comp plan)~~ Built, then removed with ADR-0014:
      signups are public, new accounts start read-only and pick a plan
- [x] Account deletion self-serve (GDPR) — shipped 2026-08-20 (ADR-0017):
      Settings → Account, password-confirmed, hard delete
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
- [x] In-app "upcoming" view for followed shows — the home feed's
      scroll-down direction covers this (2026-08-12). The people half waits
      on Phase 1 slice 4 (people don't exist yet)
- [x] Tokenized per-user iCal feed — shipped 2026-08-20 (ADR-0018);
      subscribe from Settings → Watching → Calendar

## Phase 5 — Charge (public launch, only if 1–4 prove out)

Billing shipped early and differently than sketched here: **Polar as
merchant of record** (ADR-0013), one paid tier sold monthly/annual/lifetime
— see VISION.md for the live pricing. The Basic/Pro split never happened.

- [x] Payments: Polar checkout, webhook-driven entitlements, customer portal
- [x] Entitlement checks (single helper, `requireWriteAccess` in
      `apps/web/src/lib/plan.ts`, keyed on `profiles.plan`)
- [x] Self-hosted mode: `SELF_HOSTED=true` removes the paywall (ADR-0019)
- [ ] Going public on GitHub — [plans/going-public.md](plans/going-public.md)
- [ ] Launch posts (Reddit migration threads etc.) — after the TV Time
      plan's remaining prerequisite (one real redacted export to validate
      against)

## Icebox (explicitly deferred)



- Batch `resolve_entities()` for search — a search currently spends one RPC
  per result (~25 subrequests). The paid plan's cap is no longer the concern
  (ADR-0016), but a single jsonb-array function would still cut the
  round-trips to a handful and speed search up.

- Migrate auth email from Mailjet to Cloudflare Email Service — we're on
  Workers Paid (ADR-0016); waiting on the service going GA (ADR-0009; SMTP
  credential swap)

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

- ~~**Import from TV Time exports**~~ **Shipped 2026-08-19** (ADR-0015,
  ADR-0016; plan and format notes preserved in
  [docs/plans/tvtime-import.md](plans/tvtime-import.md)): parsed in the
  browser against a filename allow-list, previewed free at the public
  `/import/tv-time` page, committed behind the plan as a resumable
  background job with a per-show reconciliation report. Data export and
  self-serve deletion shipped since (ADR-0017); the one prerequisite still
  standing before a Reddit launch is a real redacted export to validate
  against — ask in the migration threads first.
