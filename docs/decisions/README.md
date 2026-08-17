# Architecture Decision Records

One file per decision, numbered, never deleted. A superseded decision gets
`Status: superseded by ADR-XXXX` — history stays intact.

Template:

```markdown
# ADR-XXXX: Title

- Status: accepted | superseded by ADR-YYYY
- Date: YYYY-MM-DD

## Context
## Decision
## Consequences
```

| ADR | Decision |
|---|---|
| [0001](0001-nextjs-radix-themes.md) | Next.js + Radix UI Themes |
| [0002](0002-cloudflare-workers-hosting.md) | Host on Cloudflare Workers (OpenNext) |
| [0003](0003-supabase-postgres-auth.md) | Supabase for Postgres + Auth |
| [0004](0004-tvdb-behind-provider-abstraction.md) | TVDB only, behind a provider abstraction |
| [0005](0005-fsl-license.md) | FSL-1.1-Apache-2.0 license |
| [0006](0006-single-app-monorepo.md) | Monorepo with a single Next.js app |
| [0007](0007-node-npm-toolchain.md) | Plain Node + npm toolchain |
| [0008](0008-brevo-transactional-email.md) | ~~Brevo for transactional email~~ (superseded) |
| [0009](0009-mailjet-then-cloudflare-email.md) | Mailjet for email now, Cloudflare Email Service later |
| [0010](0010-cron-cloudflare-not-supabase.md) | Scheduled jobs run where their code lives |
| [0011](0011-recovery-token-spent-on-submit.md) | Recovery links land on a form; token spent on submit |
| [0012](0012-library-lazy-loading.md) | Library lists lazy-load through client-held pages |
| [0013](0013-polar-merchant-of-record.md) | Polar as merchant of record for payments |
