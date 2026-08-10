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

Deploy the Next.js app to Cloudflare Workers using `@opennextjs/cloudflare`,
on the Workers **paid** plan. DNS, CDN, hosting, and cron triggers all live
at Cloudflare.

## Consequences

- One infra provider (plus Supabase); very low cost floor and gentle scaling.
- Constraints to respect:
  - 10 MiB worker bundle limit — evaluate bundle impact of new dependencies.
  - `next/image` needs a custom loader (Cloudflare Images) or `unoptimized`.
  - The adapter, while GA, can trail brand-new Next.js features — prefer
    boring Next.js features; check adapter support before adopting new ones.
- Escape hatch: the app remains a standard Next.js app, so moving to Vercel
  (or Node self-hosting, relevant for self-hosters) stays possible.
