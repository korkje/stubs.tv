# Plan: Sign in with Apple/Google, linkable in settings

Status: **not started**. Written 2026-08-24 to be picked up cold; the
Supabase behaviours below were verified against their current docs that
day. Sibling of [magic-link-login.md](magic-link-login.md) — the two share
the passwordless wrinkle (see below), and whichever ships first pays for
solving it.

## Why

- **OAuth sign-ins need no email verification round-trip.** Google asserts
  the email verified; Apple issues verified (or relay) addresses. Like the
  magic-link plan, this removes the confirmation-email step — but with one
  tap instead of an inbox visit, which is the strongest conversion path on
  phones, where this product lives.
- Every skipped verification email is also one fewer Mailjet send at the
  moment traffic spikes (see the launch email-wall discussion, 2026-08-24).
- Passwords remain fully supported, as in the magic-link plan. OAuth is
  presented first/highlighted; password entry stays below it.

## What Supabase gives us (verified 2026-08-24)

- **Automatic identity linking is built in.** An OAuth sign-in whose email
  matches an existing user with a **verified** email links to that user
  rather than creating a new one. At link time, Supabase *removes
  unconfirmed identities* on the target account — deliberate anti-takeover
  behaviour. So the scary case — "someone signs in with Google using the
  same address as an existing password account" — resolves to: same
  account, one user, provided the password account verified its email
  (production requires verification, so this holds).
- **Manual linking is a dashboard/config toggle** ("Enable manual linking";
  local: `[auth] enable_manual_linking` / `GOTRUE_SECURITY_MANUAL_LINKING_ENABLED`).
  Once on, a signed-in user calls `supabase.auth.linkIdentity({ provider })`
  → OAuth dance → identity attaches to the *current session's* user,
  regardless of email. This is what the settings "Connect" buttons use, and
  it is also the escape hatch for every case automatic linking can't reach
  (Apple relay addresses, different emails per provider).
- **Unlinking requires ≥ 2 identities** — Supabase refuses to strand an
  account with zero ways in. An email/password login is itself an identity
  (`email`), so "Google + password" can drop either one.

## The collision matrix

| Situation | What happens | Our work |
|---|---|---|
| OAuth sign-in, email matches a **verified** existing account | Auto-links; user lands in their existing account | Nothing |
| OAuth sign-in, email matches an **unverified** account | No link (verified emails only) — likely a second account | Acceptable: unverified accounts are empty shells here (read-only, nothing written). Don't build for it |
| OAuth sign-in, Apple **relay** address, user already has an account under their real email | New, separate account — emails don't match and never will | This is the real duplicate-account risk. Mitigation is the settings **Connect** flow plus copy on the login page ("already have an account? sign in and connect Apple in Settings"). A data merge is deliberately out of scope |
| Settings **Connect**, identity's email belongs to *another* user | `linkIdentity` fails (GoTrue 422, `identity_already_exists`) | Catch and say it plainly: "That Google account is already connected to a different stubs.tv account." Confirm the exact error code when building |
| **Disconnect** in settings | Allowed only while a second identity remains (GoTrue enforces; we mirror it in UI) | Hide/disable the button on the last identity; offer "set a password first" via the existing recovery flow |
| OAuth-only user hits a password-reauth flow | See below | See below |

## The passwordless wrinkle (shared with the magic-link plan)

Account deletion (ADR-0017) and password change both reauthenticate with
the **current password**, which an OAuth-only account does not have. Same
resolution the magic-link plan sketches: the recovery flow (ADR-0011) lets
any account set a password, and the two forms must signpost that instead of
dead-ending. Decide once, here or there — whichever plan builds first.

Also from the magic-link plan and equally true here: `handle_new_user`
creates profiles for any auth method, so signup-side plumbing is zero.

## Apple-specific taxes (the owner has paid these before, at Alphatek)

1. **The client secret is a JWT that expires every 6 months**, derived from
   the long-lived `.p8` signing key. Unautomated, this is a production
   outage on a timer. Automate it: the repo already drives the Supabase
   Management API from CI (`scripts/push-email-templates.sh` pattern), and
   the same API can PATCH the Apple provider secret. A scheduled workflow
   in the **private ops repo** (every ~5 months; `.p8`, team id, key id as
   repo secrets) mints the JWT and pushes it. Ops runbook lives there too.
2. **Relay email deliverability**: to *send* mail (Mailjet) to
   `@privaterelay.appleid.com` addresses, the sending domain must be
   registered under "Certificates → Services → Sign in with Apple for
   Email Communication" in the Apple Developer console, or auth emails to
   those users silently bounce. One-time, but it must be on the setup
   checklist (ops repo).
3. **The name arrives only on the first authorization** — capture it into
   `profiles.display_name` on first sign-in (`updateUser` or the profile
   trigger's metadata path); every later sign-in returns null.
4. Supabase's docs note their in-browser secret generator doesn't work in
   Safari. Noted for the setup day's irony.

## UI

- **Login/signup**: provider buttons above the email/password fields,
  visually primary. Follow each provider's button branding rules loosely
  (Radix `Button` with provider mark; no need for their embedded JS kits —
  Supabase's `signInWithOAuth` redirect flow is a plain button handler).
  Return-to-destination must ride through the OAuth redirect the same way
  the `next` param does for passwords.
- **Settings → Account**: a "Connected sign-ins" list built from
  `getUserIdentities()` — one row per provider (Google, Apple, email) with
  Connect/Disconnect per the matrix above.
- Which providers render is configuration, not code:
  `NEXT_PUBLIC_AUTH_PROVIDERS="google,apple"` (unset → no buttons), so
  self-hosters (ADR-0019 spirit) get a working password/magic-link
  instance with zero Apple/Google setup.

## Setup (owner, one-time — the part that is a hassle)

Google Cloud OAuth client + Supabase dashboard config; Apple Developer
App ID + Services ID + `.p8` key + secret automation (above); redirect
URLs for prod and local; local `config.toml` provider blocks so the flow
is testable offline-ish. Record the resource ids and steps in the private
ops repo, not here (going-public Decision 3 convention).

## Open decisions (owner)

1. Google + Apple both, or Google first? (Apple carries 3 of the 4 taxes
   above; but Apple users are exactly the iPhone-calendar/TV-Time crowd —
   and if native apps ever ship, App Store rules require Sign in with
   Apple whenever other social logins exist.)
2. Does this land before or after magic-link? They overlap in benefit
   (verification skip) and share the wrinkle work; shipping both at once
   makes the login page redesign a single change.
3. The relay-duplicate mitigation copy: settle the exact wording at build
   time.
