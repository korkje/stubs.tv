# ADR-0002: Host on Cloudflare Workers via OpenNext

- Status: accepted
- Date: 2026-08-10

## Context

The domain (stubs.tv) is already on Cloudflare. Candidates: Vercel (native
Next.js) vs Cloudflare Workers (OpenNext adapter). Requirements: cheap at
hobby scale, sane at large scale (no rearchitecting), commercial use allowed.

Vercel's Hobby tier prohibits commercial use, so charging even $1/mo forces
Pro at $20/mo/member, and bandwidth/function pricing scales steeply.
Cloudflare's `@opennextjs/cloudflare` adapter reached 1.0 GA (Feb 2026) and
is Cloudflare's officially documented Next.js path; Workers paid is $5/mo
with generous included usage.

## Decision

Deploy the Next.js app to Cloudflare Workers using `@opennextjs/cloudflare`.
DNS, CDN, hosting, and cron triggers all live at Cloudflare.

Started on the Workers **free** plan (2026-08-10), and staying there through
development *on purpose* (decided 2026-08-11).

The free plan's 10ms CPU budget already produced two changes worth having on
their own merits: per-season counts computed in SQL rather than by reducing
over every episode in the worker, and series pages that render one season at
a time instead of all 875 episodes. Discovering that ceiling now, while the
app has one user and changes are cheap, beats discovering it later.

**Upgrade when any of these is true** — not on a date:

1. A feature we actually want cannot be done well inside 10ms. Phase 2's
   analytics is the likely trigger: aggregation belongs in SQL either way,
   but rendering a dense visualisation is CPU, and the app's most
   distinctive feature should not be compromised to save $5/month.
2. Before opening up to friends and family (Phase 3). Someone else hitting
   HTTP 1102 gets a broken page and no recourse. This also coincides with
   Cloudflare Email Service becoming available (ADR-0009).
3. When a workaround stops being independently good. Collapsing seasons was
   worth doing regardless; adding a caching layer purely to dodge a render
   would be paying complexity to avoid a cheap subscription. That is the
   signal the constraint has stopped teaching and started taxing.

Until then: `observability` is enabled on the worker, so CPU time per
invocation is visible in the Cloudflare dashboard. Check it after deploying
anything render-heavy rather than waiting for a 1102 in production.

## Consequences

- One infra provider (plus Supabase); very low cost floor and gentle scaling.
- Constraints to respect:
  - **3 MiB** worker bundle limit on the free plan (10 MiB when paid) —
    evaluate bundle impact of new dependencies.
  - `next/image` needs a custom loader (Cloudflare Images) or `unoptimized`.
  - The adapter, while GA, can trail brand-new Next.js features — prefer
    boring Next.js features; check adapter support before adopting new ones.
- Escape hatch: the app remains a standard Next.js app, so moving to Vercel
  (or Node self-hosting, relevant for self-hosters) stays possible.
