# Privacy & GDPR strategy

The owner and initial users are in Europe; GDPR applies from day one. The
product's philosophy makes this easy: watch history is *the user's* data.

## Principles

1. **Data minimization.** We store: email (auth), display name, plan, follows,
   watches. Nothing else. No trackers, no third-party analytics scripts on the
   app (if we ever want product analytics, use a privacy-respecting,
   EU-hostable option and add it to this doc first).
2. **EU data residency.** Supabase project in an EU region (Frankfurt).
   Cloudflare processes requests globally as a CDN/compute layer; note this in
   the privacy policy.
3. **Right of access / portability.** Self-serve JSON export of all user data
   — shipped: Settings → Account → "Download my data", backed by the
   `export_user_data()` SQL function (ADR-0017). Human-readable titles, no
   internal or provider IDs, available on every plan.
4. **Right to erasure.** Self-serve account deletion — shipped: Settings →
   Account, password-confirmed (ADR-0017). Deleting the auth user cascades
   through every user table; no soft-delete retention of personal data. Any
   active Polar subscription is cancelled first and the Polar customer
   anonymized; Polar keeps the anonymized order records it must hold as
   merchant of record.
5. **Lawful basis.** Contract (providing the service) for account data;
   consent only if we ever add optional extras (e.g. email notifications —
   opt-in, per-purpose).
6. **No selling/sharing data.** Ever. Say so plainly in the policy.

## Processors (to list in the privacy policy)

| Processor | Purpose | Data |
|---|---|---|
| Supabase (EU) | Database, auth | email, user data |
| Cloudflare | Hosting, CDN, DNS | request metadata (IPs in transit) |
| Mailjet (EU) | Transactional email (verification, password reset) | email address |
| Polar | Payments (merchant of record) | billing details (never stored by us) |

TheTVDB receives no user data — metadata requests are server-side and carry
no user identifiers.

## To do before friends & family (Phase 3)

- [x] Privacy policy page (`/privacy` — keep in lockstep with this doc)
- [x] Terms of service page (`/terms`)
- [x] Account deletion flow tested end-to-end (2026-08-20, local: password
      reauth, Polar-failure fallback, full cascade verified row-by-row)
- [x] Cookie situation: strictly necessary only — verified 2026-08-20 on a
      signed-in page: one `sb-*-auth-token` cookie, empty localStorage. No
      cookie banner required, and the privacy page says so
