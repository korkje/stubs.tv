# Vision

## One-liner

stubs.tv keeps track of the movies and TV shows you watch, episode by
episode: what you have seen, what is left, and how much time it added up to.

## Name

The product name is **stubs.tv**, always lowercase and always with the TLD —
the Last.fm model, where the domain is the brand. Never bare "stubs" in
user-facing surfaces (UI copy, titles, emails, store listings): the word
alone is generic, unsearchable, and collides with AMC's loyalty program. The
name refers to movie ticket stubs.

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
2. **Phase 2: friends & family**, free, by invitation.
3. **Phase 3: paid public plans**, only if phases 1–2 prove the product.

## Monetization plan

No free tier at public launch — pricing exists to cover costs, not maximize
revenue:

| Plan | Monthly | Yearly | Notes |
|---|---|---|---|
| Basic | $1 | $10 | Full tracking + analytics |
| Pro | $3 | $30 | Feature split TBD (candidates: iCal feeds, advanced analytics, API access) |

Friends & family keep free accounts (comp flag). Self-hosting is always free
(FSL license permits it; it forbids competing commercial offerings).

Cost floor to beat: Cloudflare Workers paid ($5/mo) + Supabase Pro ($25/mo
once free tier is outgrown) + TVDB key (free under $50k/yr revenue) ≈ $30/mo,
i.e. ~30 Basic subscribers to break even.

## Product principles

- **Fast** — tracking one episode should take one tap and no page reload.
- **Yours** — export everything, delete everything, self-host everything.
- **Calm** — no engagement bait, no streaks, no guilt. It's a memory box.
