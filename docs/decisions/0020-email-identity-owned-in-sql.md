# ADR-0020: Email/password sign-in state is kept true by our own SQL

- Status: accepted
- Date: 2026-08-26

## Context

The settings page derives "this account has email & password" from the
GoTrue identities list (`provider === 'email'`), and gates three things on
it: the sign-in-methods row, password management, and the password
confirmation that account deletion requires (ADR-0017). GoTrue, however,
only creates the `email` identity at email signup. Verified empirically
against GoTrue v2.188.1 (local; prod ran v2.195.0 and behaved the same):

- `updateUser({ password })` — how the recovery flow sets a password —
  writes `auth.users.encrypted_password` and **never** creates the `email`
  identity. Password sign-in does not check identities, so the password
  works while every identity-based check says it does not exist.
- Unlinking the `email` identity deletes the row but **leaves the password
  working** — the inverse hole.
- A `NULL` or `''` `encrypted_password` fails the password grant cleanly
  (400 `invalid_credentials`); OAuth-created users carry exactly that.

The practical damage before this decision: an account created through
Google/Apple could never satisfy `hasPassword`, so the deletion form told
it to run password reset — which set a working password without ever
flipping the check. Self-serve erasure (GDPR, docs/PRIVACY.md) was
unreachable for every OAuth-signup account, and the "passwordless
wrinkle" signposts in docs/plans/oauth-login.md rested on a false premise.

No public Supabase API exposes "user has a password", and no admin API
creates or deletes identity rows. The only honest representations are
either a bespoke "has password" probe of `auth.users` or owning the
identity row ourselves.

Upstream knows (supabase/auth#2085, #2320) and fixed the insert half in
GoTrue v2.196.0 (`ensureEmailIdentityForPassword`, 2026-08-03) — but
behind `GOTRUE_EXPERIMENTAL_CREATE_EMAIL_IDENTITY_ON_PASSWORD_SET_ENABLED`,
default off, not enabled on hosted Supabase, and with no backfill for
already-affected users. Waiting on that flag would leave the deletion
gate broken indefinitely.

## Decision

Two `security definer` functions (migration `20260826150000`) keep the
`email` identity row and `encrypted_password` in lockstep, making the
identities list a truthful inventory of sign-in methods:

- **`ensure_email_identity()`** inserts the `email` identity for
  `auth.uid()` iff a real password exists, the email is confirmed
  (upstream's own guard), and the row is missing — idempotent via the
  `(provider_id, provider)` unique constraint, shaped exactly like the
  row GoTrue writes at email signup (`provider_id` = user id,
  `identity_data` = `{sub, email, email_verified, phone_verified}`).
  `email_verified` is `true` by construction: a password only ever
  arrives through a mailbox-proven flow. Called (non-fatally) after the
  recovery flow sets a password and after every successful password
  sign-in, so accounts from before this decision self-heal on first use.
- **`remove_email_login()`** deletes the identity row **and** nulls the
  password together, refusing when no other identity remains (mirrors
  GoTrue's last-identity rule). GoTrue's own unlink is not used for the
  email row because it leaves the password live. The account email is
  untouched: it remains the recovery anchor, so email/password can be
  re-added later and no account can be orphaned.
- Both re-derive `raw_app_meta_data.providers` from the identities table
  after writing (helper `rederive_providers`, executable by no one but
  the definer functions), because GoTrue and the dashboard derive the
  provider list from it — exactly what upstream's fix does.

With the inventory truthful, settings drops the in-place change-password
form entirely: setting *and* changing a password both go through the
emailed recovery link (ADR-0011's flow), triggered from settings. One
mailbox round trip is the single proof-of-ownership path for anything
that creates a password.

## Consequences

- The `hasPassword` gate (deletion, password row) is now accurate for all
  accounts; pre-existing OAuth+password accounts converge on their next
  password sign-in or reset.
- These functions write `auth.users` / `auth.identities` directly. That
  rests on the `postgres` role's DML grants on `auth.*` (present on the
  hosted platform and locally) and on GoTrue's row shape — both proven
  today, both worth re-verifying when GoTrue is upgraded. When the
  upstream flag ships for real (watch
  `GOTRUE_EXPERIMENTAL_CREATE_EMAIL_IDENTITY_ON_PASSWORD_SET_ENABLED`
  going GA/enabled on hosted), `ensure_email_identity` degrades to a
  no-op (`on conflict do nothing`) and can be retired; only
  `remove_email_login` needs a fresh look — upstream has no
  disconnect-email equivalent.
- "Disconnect email & password" honestly disables password sign-in, but
  does not disable email-based *recovery* — deliberate, per above.
- Sessions are not revoked on disconnect, matching provider unlink and the
  ROADMAP icebox stance on revocation.
- ADR-0011's context mentions the settings change-password flow; that flow
  is gone, but 0011's actual decision (tokens spent on submit, sessions
  never trusted) is unchanged — and is now the only password-setting path.
