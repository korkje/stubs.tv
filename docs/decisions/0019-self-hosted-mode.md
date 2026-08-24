# ADR-0019: Self-hosted mode removes the paywall behind an explicit flag

- Status: accepted
- Date: 2026-08-24

## Context

The repo is about to go public (docs/plans/going-public.md), and the README
pitches self-hosting as a first-class path. But ADR-0014 makes fresh
accounts read-only until they pay, and payments run through Polar (ADR-0013)
— so a fresh self-hosted instance was read-only for everyone unless the
operator hand-comped accounts from the Supabase dashboard. That undercuts
the self-hosting story on day one, and FSL explicitly permits self-hosting.

Two detection mechanisms were considered: an explicit `SELF_HOSTED=true`
environment flag, or inferring the mode from missing Polar configuration.

## Decision

**An explicit `SELF_HOSTED=true` flag, checked by one helper**
(`apps/web/src/lib/self-hosted.ts`). Inference from missing Polar config was
rejected: on a commercial deploy a missing `POLAR_ACCESS_TOKEN` should
surface as a loud checkout failure, not silently unlock the product for
free. Self-hosting is a deliberate choice; the flag makes it one.

When the flag is set:

- `requireWriteAccess()` passes any signed-in account regardless of
  `profiles.plan` (the plan column stays — flipping the flag off restores
  ADR-0014 behaviour unchanged, and comp/paid rows keep meaning).
- The pricing/billing surfaces disappear: the landing pricing section, the
  read-only banner, the settings Billing tab (including `?tab=billing` deep
  links), and `/app/plans` shows a "self-hosted, full access" notice instead
  of plans.
- `/checkout` and `/billing` redirect to `/app` instead of calling Polar.

Enforcement stays app-layer only, exactly as ADR-0014 records: RLS already
scopes writes to the caller's own rows.

## Consequences

- A fresh clone + `SELF_HOSTED=true` is fully usable with zero Polar
  configuration — the self-hosting path in the README works from day one.
- The flag must reach the server code everywhere it renders: `.env.local`
  in dev; for a Workers deploy both the build environment (prerendered
  marketing pages read it at build time) and `wrangler.jsonc` `vars`
  (request-time rendering). Documented in `.env.example`.
- The production stubs.tv deployment simply never sets the flag; no
  behaviour changes there.
- The webhook route stays mounted but is inert without Polar secrets, which
  was already true.
