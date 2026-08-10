# stubs

**Keep your ticket stubs.** Track the movies and TV shows you watch — search, follow shows and people, mark things as seen, and get a beautiful overview of your watch history.

> The name refers to movie ticket stubs: this is like keeping a box of them, but for everything — TV included.

**Domain:** [stubs.tv](https://stubs.tv) · **Status:** planning / pre-code

## Why

The tracking service the owner relied on for years went offline one day and took all its watch history with it. stubs is the replacement: better UI, movies included, and — because it's fair-source and self-hostable — your data can never vanish with someone else's server.

## What it will do

- **Search** movies and TV shows (metadata from TheTVDB)
- **Follow** shows, actors, and directors
- **Track** what you've seen — per episode, season, or movie
- **Analytics** — total watch time, era heatmaps ("you love 80s sitcoms"), and more
- **Calendar** — upcoming releases for things you follow (in-app first, iCal feed later)

## Stack (decided — see [docs/decisions/](docs/decisions/))

| Layer | Choice |
|---|---|
| Framework | Next.js (TypeScript), single app for marketing + webapp + admin |
| UI | Radix UI **Themes** (the full component library) |
| Hosting | Cloudflare Workers via the OpenNext adapter |
| Database + Auth | Supabase (Postgres, EU region) |
| Metadata | TheTVDB v4, behind a provider abstraction |
| License | [FSL-1.1-Apache-2.0](LICENSE.md) (fair source) |

## Repository layout (planned)

```
apps/web/        Next.js app — marketing pages, the webapp, admin routes
packages/        Shared code as it emerges (tvdb client, db types, …)
supabase/        Database migrations and local config
docs/            All planning and architecture documentation
```

## Documentation map

| Doc | What's in it |
|---|---|
| [docs/VISION.md](docs/VISION.md) | Product vision, features, monetization plan |
| [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) | System design, hosting, data flow |
| [docs/DATA-MODEL.md](docs/DATA-MODEL.md) | Draft database schema |
| [docs/ROADMAP.md](docs/ROADMAP.md) | Phased plan from MVP to paid plans |
| [docs/PRIVACY.md](docs/PRIVACY.md) | GDPR strategy |
| [docs/decisions/](docs/decisions/) | Architecture Decision Records (ADRs) |
| [AGENTS.md](AGENTS.md) | Instructions for AI coding agents |

## Running locally

Requires Node ≥24 (see `.nvmrc`) and Docker (for the local Supabase stack).

```sh
npm install
npx supabase start        # prints the local API URL and anon key
cp apps/web/.env.example apps/web/.env.local   # paste the anon key in
npm run dev               # http://localhost:3000
```

Self-hosting is a first-class, documented path and will stay that way.

## License

[FSL-1.1-Apache-2.0](LICENSE.md): free to use, self-host, modify, and contribute to. You may not offer it as a competing commercial product. Each release converts to Apache-2.0 two years after publication.
