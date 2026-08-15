# ADR-0011: Recovery links land on a form; the token is spent on submit

- Status: accepted
- Date: 2026-08-15

## Context

Every other auth email in this project links to `/auth/confirm`, which
verifies the token on GET and signs the user in (see docs/DEPLOYMENT.md —
Auth configuration). Password recovery cannot follow that pattern:

- Verifying on GET signs the user in and drops them in the app without ever
  asking for a new password, which is the entire point of the mail.
- Mail clients and security scanners prefetch links. A token spent on GET can
  be burnt before the recipient clicks, and recovery mail is the one flow
  where that leaves someone locked out rather than merely re-requesting.

The obvious repair — verify on GET, then show a form, and let the form fall
back to whatever session the verification created — reintroduces a worse
problem. A form that accepts an existing session in place of a token means a
stolen session cookie can set a new password without knowing the old one,
which is precisely what the settings change-password flow spends a
`signInWithPassword` re-verification to prevent. The two paths would enforce
contradictory policies on the same operation, and an attacker would simply
use the weaker one. On a shared browser it is worse still: an expired link
for one account silently changes the password of whoever is signed in.

## Decision

Recovery mail links to `/auth/reset-password?token_hash=…`. The page renders
the new-password form and does not touch the token. `verifyOtp` runs inside
the submit action, immediately before `updateUser`.

A valid token is the only way through. The action never falls back to an
existing session, and the page renders no form without a token.

To keep that strictness survivable, the password-length check runs *before*
the token is spent, so the common retry never costs a token; and GoTrue's
`same_password` error is treated as arrival rather than failure, since the
user already has the password they asked for and the token is gone by then.

## Consequences

- `/auth/confirm` is unchanged and still handles `type=recovery`, so recovery
  links already sitting in inboxes keep working.
- A password rejected by the hosted project's policy (which can be stricter
  than `minimum_password_length` in supabase/config.toml, and is not visible
  from the repo) spends the token and sends the user back for a fresh link.
  Widening the pre-spend validation is the fix if that shows up in practice.
- Do not "unify" recovery back onto `/auth/confirm`. It reads like tidying and
  silently restores both the prefetch and the stolen-session problems.
- Session revocation after a password change is deliberately not part of this
  decision — see the ROADMAP icebox.
