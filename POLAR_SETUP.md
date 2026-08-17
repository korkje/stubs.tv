# Polar payments — setup record & checklist

Integration of [Polar](https://polar.sh) (merchant of record) into
`apps/web`, done 2026-08-17 against the **live production environment**
of the `stubs-tv` organization. See ADR-0013 for the decision record.

Dashboard: https://polar.sh/dashboard/stubs-tv

## Files created / changed

- `apps/web/src/lib/polar.ts` — shared `@polar-sh/sdk` client
  (lazy singleton; `POLAR_SERVER` selects sandbox/production).
- `apps/web/src/app/checkout/route.ts` — `GET /checkout?products=<id>`
  creates a Polar checkout and redirects to the hosted page.
- `apps/web/src/app/api/webhook/polar/route.ts` — signature-verified
  webhook receiver; `order.paid` and `customer.state_changed` are TODO
  stubs awaiting entitlement wiring.
- `apps/web/package.json` — added `@polar-sh/sdk`.
- `apps/web/.env.local` / `.env.example` — new keys (names below).
- `docs/decisions/0013-polar-merchant-of-record.md` + index row.

## Environment keys (names only — values live in .env.local, never in git)

| Key | Purpose |
|---|---|
| `POLAR_ACCESS_TOKEN` | Org access token (products, checkouts, webhooks, discounts — read/write) |
| `POLAR_WEBHOOK_SECRET` | Signing secret of the webhook endpoint below |
| `POLAR_SERVER` | `production` in prod; `sandbox` for local experiments |
| `POLAR_PRODUCT_MONTHLY` / `_ANNUAL` / `_LIFETIME` | Product ids for the pricing section — per environment, not secret (production values in `wrangler.jsonc` `vars`) |

## Provisioned Polar resources (production)

| Resource | Id |
|---|---|
| Organization `stubs-tv` | `975b2319-e7f5-4502-882d-88e28d34c809` |
| Product "stubs.tv Monthly" ($2.95/€2.95/29 kr per month) | `363dbfa0-1d8b-4dbb-aecb-f3d07b5369a1` |
| Product "stubs.tv Annual" ($24.95/€24.95/249 kr per year, 1-month trial) | `e75b25c4-ee85-4702-821f-51eeddf721c4` |
| Product "stubs.tv Lifetime" ($149.95/€149.95/1 499 kr one-time) | `57b4806e-10ad-42bc-ba75-b523662f0523` |
| Product "Test Product" ($10 one-time — archive after testing) | `c923c170-5a93-4e63-9487-a3ff8fd7deed` |
| Webhook endpoint → `https://stubs.tv/api/webhook/polar` | `7e31ac3a-7dfb-425a-b0a6-f60b6ec6e1f1` |

Products carry `metadata.tier = "paid"` (and `metadata.lifetime = true` on
the lifetime pass); the webhook handler keys on that metadata, never on
hardcoded product ids, so future products just need the same tags.

## Verify before merging

- [ ] `npm run typecheck` and `npm run build` pass (done at setup time;
      bundle 2.0 MiB gzipped of the 3 MiB Workers limit).
- [x] **Set production secrets on the Worker** — done 2026-08-17
      (`wrangler secret list` shows both; `POLAR_SERVER=production` is in
      `wrangler.jsonc` `vars`). If the token is ever rotated, rerun
      `npx wrangler secret put POLAR_ACCESS_TOKEN` from `apps/web/`.
- [ ] After deploy: `curl -i https://stubs.tv/checkout?products=c923c170-5a93-4e63-9487-a3ff8fd7deed`
      returns a 302 to `polar.sh/checkout/...`.
- [ ] Test checkout end-to-end with the `STUBSTEST` discount code
      (100% off, restricted to Test Product, id
      `c82c64a1-e5f8-48eb-bcac-9c78e54077fe`) — entering the code on the
      checkout page avoids a real charge. Confirm the webhook delivery
      shows 200 in Dashboard → Webhooks. Note what this proves: delivery
      and signature verification only — Test Product carries no `tier`
      metadata, so the handler correctly no-ops. A real plan flip in
      production needs a 100% code on a real product (the entitlement
      logic itself was verified locally with synthetic signed events).
- [ ] Delete/archive "Test Product" and the test discount once real
      products exist.

## Notes

- **`/checkout` requires login** — it sets Polar's `external_customer_id`
  to the app user id, which is the entire user↔customer mapping. Webhook
  handlers sync `billing` + `profiles.plan` from events (see ADR-0013 and
  DATA-MODEL.md); the handler flow was verified locally with synthetic
  signed events covering subscribe, lapse, lifetime purchase, and
  lapse-after-lifetime.
- **The org is in Polar's test mode** until payment onboarding
  (identity/payout verification) completes in the dashboard. Until then
  only free or 100%-discount checkouts go through — real cards are
  rejected. Finish onboarding before announcing paid plans.
- **Never log Polar SDK error objects.** They embed the raw request,
  `Authorization: Bearer <token>` included; the checkout route catches and
  rethrows message-only for exactly this reason. Keep that pattern in any
  new Polar calls. (The original access token was exposed this way in a
  local dev log during setup and **must be rotated before deploy**: create
  a new token with products, checkouts, webhooks **and discounts**
  read/write scopes, update `apps/web/.env.local`, re-run
  `npx wrangler secret put POLAR_ACCESS_TOKEN`, then revoke the old one.)

- **Customer portal needs no app code.** Polar hosts it and emails
  customers the link (order confirmations link there too). An in-app
  "Manage billing" link is optional, later.
- **This runs against live production.** Checkouts without a 100%
  discount charge real cards and remit real VAT. The sandbox is a
  separate environment (separate token, products, webhooks) at
  `sandbox.polar.sh`.
- Webhook events are only `order.paid` and `customer.state_changed` for
  now; extend the endpoint's event list in the dashboard (or via API)
  when the handlers grow.
