# ADR-0013: Polar as merchant of record for payments

- Status: accepted
- Date: 2026-08-17

## Context

stubs.tv is moving to paid plans (see docs/VISION.md — monetization): a
hidden free tier for friends & family, monthly and annual subscriptions,
and a one-time lifetime pass, priced per-currency in USD/EUR/NOK. Selling
to EU consumers means VAT registration and remittance in every buyer
country — a non-starter for a solo project. A merchant of record (MoR)
sells to the customer itself and owns that tax liability.

Candidates were Polar, Paddle, and Lemon Squeezy (all MoR), or Stripe
directly (not MoR — VAT stays our problem). Polar is developer-first,
API-complete (products, checkouts, discounts, webhooks), supports
per-currency prices on one product, subscription trials, and hosts both
the checkout and the customer portal so the app carries no billing UI.
Fees (Starter plan, 2026): 5% + 50¢ per transaction, +1.5% non-US cards.

## Decision

Use Polar (polar.sh) as merchant of record, integrated with
`@polar-sh/sdk` directly (no per-framework adapter):

- `apps/web/src/lib/polar.ts` — one lazily-constructed SDK client;
  `POLAR_SERVER` picks sandbox vs production, never hardcoded.
- `GET /checkout?products=<id>` — creates a Polar checkout and redirects
  to the Polar-hosted page. No success URL: Polar shows its own
  confirmation.
- `POST /api/webhook/polar` — signature-verified (Standard Webhooks)
  ingest of `order.paid` and `customer.state_changed`; this is the only
  path by which payment state enters the app.
- Customer portal is Polar-hosted (emailed to customers) — no app code.

Entitlements are driven from webhook events into Postgres (the `billing`
table plus `profiles.plan`, see DATA-MODEL.md), so the app reads access
rights from its own database, never from Polar in the request path. The
checkout route requires login and sets Polar's `external_customer_id` to
the app's user id; webhook events carry it back, and that is the entire
user↔customer mapping. `plan = 'comp'` accounts have no billing row and
are never touched by the sync.

## Consequences

- Polar owns VAT/MVA compliance, invoicing, and the checkout/portal UX;
  we ship no billing UI and store no payment data (GDPR surface stays
  minimal — Polar is a processor/controller for billing PII).
- Self-hosting escape hatch (ground rule 4): payments are optional —
  with the Polar env vars unset the app runs fine, the routes just 500
  on use; `POLAR_SERVER=sandbox` points at Polar's sandbox for local
  work. A different provider would touch only `lib/polar.ts`, the two
  routes, and the webhook handlers.
- The deployed Worker needs `POLAR_ACCESS_TOKEN`, `POLAR_WEBHOOK_SECRET`
  and `POLAR_SERVER` as Cloudflare secrets — see POLAR_SETUP.md.
- Production and sandbox are separate Polar environments with separate
  tokens, products, and webhooks; ids in one do not exist in the other.
- Fee structure favors annual/lifetime over cheap monthly (50¢ fixed fee
  is ~23% of a $2.95 monthly), which shaped the pricing tiers.
