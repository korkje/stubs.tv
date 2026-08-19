# Vision

## One-liner

stubs.tv keeps track of the movies and TV shows you watch, episode by
episode: what you have seen, what is left, and how much time it added up to.

## Name

The product name is **stubs.tv**, always lowercase and always with the TLD —
the Last.fm model, where the domain is the brand. Never bare "stubs" in
user-facing surfaces (UI copy, titles, emails, store listings): the word
alone is generic, unsearchable, and collides with AMC's loyalty program. The
name refers to movie ticket stubs. Infrastructure identifiers (the GitHub
repo, Supabase project, Cloudflare Worker) stay plain "stubs" — some of
those namespaces do not allow dots.

Write copy plainly. The ticket-stub name is a good one and does not need
explaining or embellishing in the product's own voice.

## Origin

The owner used a TV-tracking service for years. One day it was gone, along
with all watch history. It also had a dated UI and no movie support. stubs.tv
exists to fix all three failures:

1. **Durability** — fair-source and self-hostable; the data can't die with a
   single company's server. Users can always export everything.
2. **Quality** — a simple, modern UI (Radix Themes) that's a pleasure to use.
3. **Completeness** — TV and movies in one place.

## Core features

### Tracking (the heart of the product)
- Search movies and TV shows (TheTVDB metadata).
- Mark movies as seen; mark TV as seen per episode, per season, or per show.
- Follow shows, actors, and directors.
- Unfollow/unmark everything just as easily; history is editable.

### Overview & analytics (the delight)
- Total watch time (all time, per year, per month).
- **Era heatmap** — which production periods you watch most (e.g. "80s
  sitcoms"), rendered as a heatmap over decades × genres.
- Watch activity over time (when do *you* watch things).
- Per-show progress: seen/unseen episodes at a glance.
- Most-watched actors, directors, genres.

### Upcoming (retention)
- In-app calendar/list of upcoming releases for followed shows and people.
- Later: iCal feed subscription so releases appear in users' own calendars.

## Non-goals (for now)

- Social features (comments, public profiles, activity feeds).
- Ratings/reviews as a primary feature (a simple personal rating may come).
- Streaming-availability data ("where to watch") — nice later, not core.
- Native mobile apps — the webapp must be excellent on mobile browsers first.

## Users & rollout

1. **Phase 1: the owner.** Built for personal daily use. If it isn't good
   enough to replace nothing (the current state), it isn't good enough.
2. **Phase 2: friends & family**, free, by invitation. (Done — their
   accounts stay comped.)
3. **Phase 3: paid public plans** — live: signups are open, new accounts
   start read-only and pick a plan (ADR-0014).

## Monetization plan

One paid tier, sold three ways through Polar as merchant of record
(ADR-0013), priced per currency rather than converted:

| Product | USD | EUR | NOK | Notes |
|---|---|---|---|---|
| Monthly | $2.95 | €2.95 | 29 kr | No trial (Polar's 50¢ fixed fee makes cheaper monthlies fee-heavy) |
| Annual | $24.95 | €24.95 | 249 kr | 1-month free trial; the plan to steer people to |
| Lifetime | $149.95 | €149.95 | 1 499 kr | One-time, ~6× annual |

The **free** tier is read-only: what a new signup has before picking a
plan and what a lapsed subscriber drops to — history stays visible and
exportable, writing needs a plan. It has no Polar product; it is simply an
account with no paid entitlement. (If a writable free tier ever ships, the
gate candidates remain no calendar integration and no import.)

**Importing is a write, so it needs a plan — but the preview is free to
everyone** (ADR-0015). Because a TV Time or Trakt export is parsed in the
visitor's own browser, a logged-out stranger can drop in their file and see
what it holds — "187 shows, 4,213 episodes, back to 2013" — before being
asked for anything, and it costs us nothing to show them. The annual plan's
trial then makes the import itself free at the point of use. Considered and
rejected: a free-forever imported archive. It reads generously, but it
spends the one moment this audience converts on, and combined with data
export it would make us a free TV Time-to-anywhere conversion service —
possibly worth offering deliberately one day, not worth shipping by
accident.

Friends & family keep free full-featured accounts (`plan = 'comp'`, granted
by hand, never touched by billing). Self-hosting is always free (FSL
license permits it; it forbids competing commercial offerings).

Cost floor to beat: Cloudflare Workers paid ($5/mo) + Supabase Pro ($25/mo
once free tier is outgrown) + TVDB key (free under $50k/yr revenue) ≈ $30/mo,
i.e. ~15 annual subscribers to break even. Polar takes 5% + 50¢ (+1.5%
non-US cards) per transaction on top.

## Product principles

- **Fast** — tracking one episode should take one tap and no page reload.
- **Yours** — export everything, delete everything, self-host everything.
- **Calm** — no engagement bait, no streaks, no guilt. It's a memory box.
