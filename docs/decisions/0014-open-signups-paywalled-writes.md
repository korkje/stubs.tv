# ADR-0014: Open public signups; free accounts are read-only

- Status: accepted
- Date: 2026-08-17

## Context

Signups were invite-gated (a trigger on `auth.users`, an `invites` ledger,
and an `app_settings.open_signups` toggle) because the app had no way to
charge anyone: the gate kept the user base at friends & family until
billing existed. Payments are live (ADR-0013), so the gate now only stands
between the product and its Phase 3 rollout (paid public plans,
VISION.md). A public free-forever tier was considered and rejected: no
feature gates exist yet, so it would give away the whole product, and the
annual plan's Polar-hosted 1-month trial already covers "try before you
buy".

## Decision

1. **Remove the invite system entirely** — trigger, functions, `invites`,
   and `app_settings` (its only columns were invite state). History lives
   in git; resurrecting it would be a new decision.
2. **Public signups start read-only.** `profiles.plan` defaults to
   `'free'`: the account works, but mutating server actions call
   `requireWriteAccess()` (`apps/web/src/lib/plan.ts`), which redirects
   non-comp/non-paid accounts to `/app/plans` instead of writing. A
   layout-level banner says so. Lapsed subscribers land in the same state:
   nothing is deleted, everything stays visible and exportable.
3. **Enforcement is app-layer only.** RLS still isolates users from each
   other — a free user forging PostgREST writes can only touch their own
   rows, so the paywall is a product gate, not a security boundary. If the
   free tier ever becomes an abuse target, split the FOR ALL policies
   per-command with a plan check (`can_write()` helper).
4. **`comp` is granted by hand** (Supabase dashboard) — friends & family
   and the seeded dev account. The webhook never touches comp.
5. The marketing page gains pricing/FAQ plus `/privacy` and `/terms`;
   `/checkout` threads a validated `?next=` through login so pricing
   clicks survive authentication (same `safeNext()` also closed a latent
   open redirect in `auth/confirm`).

## Consequences

- Growth is no longer gated on the owner handing out codes; conversion is
  gated on the plans page instead.
- Polar product ids are configuration (`POLAR_PRODUCT_*`), because
  sandbox/production ids differ. A self-hosted instance without them shows
  no pricing section; its free accounts are still read-only until granted
  comp/paid by hand in the Supabase dashboard — the same behavior as
  hosted, just without a checkout to point at.
- The Supabase dashboard remains the admin UI for comping accounts; an
  in-app admin surface is future work.
- Write-control UI is not plan-aware in v1: free users see the buttons and
  get redirected on use. Threading plan state through the tracking
  components is deliberate future polish.
