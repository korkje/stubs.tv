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
   (Phase 2 — same feature as the "your data can't vanish" promise).
4. **Right to erasure.** Self-serve account deletion (Phase 3): deleting the
   auth user cascades through `profiles`, `follows`, `watches`. No soft-delete
   retention of personal data.
5. **Lawful basis.** Contract (providing the service) for account data;
   consent only if we ever add optional extras (e.g. email notifications —
   opt-in, per-purpose).
6. **No selling/sharing data.** Ever. Say so plainly in the policy.

## Processors (to list in the privacy policy)

| Processor | Purpose | Data |
|---|---|---|
| Supabase (EU) | Database, auth | email, user data |
| Cloudflare | Hosting, CDN, DNS | request metadata (IPs in transit) |
| Stripe (Phase 5) | Payments | billing details (never stored by us) |

TheTVDB receives no user data — metadata requests are server-side and carry
no user identifiers.

## To do before friends & family (Phase 3)

- [ ] Privacy policy page (plain language, list processors above)
- [ ] Terms of service page
- [ ] Account deletion flow tested end-to-end
- [ ] Cookie situation: aim for "strictly necessary only" (auth session) —
      then no cookie banner is required
