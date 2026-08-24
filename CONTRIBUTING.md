# Contributing

Thanks for your interest! stubs.tv is a one-person project that welcomes
contributions, with a few ground rules to keep it coherent.

## Before you start

- **Read [AGENTS.md](AGENTS.md).** It's written for AI coding agents but it
  is the operative engineering guide for humans too: stack, conventions,
  and the database gotchas that will otherwise cost you an afternoon.
- **Decisions are recorded in [docs/decisions/](docs/decisions/).** ADRs are
  settled; a PR that quietly relitigates one (new component library, new
  package manager, second hosting target) will be declined however good the
  code is. Open an issue first if you think a decision deserves reopening.
- **For anything non-trivial, open an issue before writing code**, so the
  approach is agreed before the effort is spent.

## Local setup

Follow "Running locally" in the [README](README.md): Node ≥24, Docker,
`npm install`, `npx supabase start`, `npx supabase db reset`, `npm run dev`.
Sign in with the seeded dev account. Set `SELF_HOSTED=true` in
`apps/web/.env.local` if you want the paywall out of the way.

## Pull requests

- Keep PRs focused — one change per PR.
- `npm run typecheck`, `npm run lint`, and `npm run build` must pass; CI
  runs all three.
- Schema changes are Supabase migration files plus regenerated types
  (`npm run db:types`) — never hand-applied changes.
- Architectural changes come with an ADR in the same PR (see
  `docs/decisions/README.md` for the template).

## License terms for contributions

The project is licensed [FSL-1.1-Apache-2.0](LICENSE.md) (Fair Source). By
contributing you agree your contribution is licensed under the same terms.
Practically: the code is free to use, self-host, and modify, but may not be
offered as a competing commercial service, and each release converts to
Apache-2.0 two years after publication.
