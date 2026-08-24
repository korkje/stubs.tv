# Plan: magic-link sign-in alongside passwords

Status: **not started**. Written up so it can be picked up cold — by a
future session, a cloud agent, or a future self. Investigated 2026-08-20;
the surprising finding is that the backend already exists end-to-end, so
this is a front-door feature, not an auth project. Sibling of
[oauth-login.md](oauth-login.md) (Apple/Google sign-in) — they share the
passwordless wrinkle below and the login-page redesign; consider shipping
together.

## What it is

A second way to sign in: type your email, get a one-time link, click it,
you're in. Passwords stay fully supported — some people (and password
managers) prefer them, and several existing flows reauthenticate with one
(see "The passwordless wrinkle"). Supabase calls this `signInWithOtp`.

Two properties make it more than a convenience:

- **Clicking the link IS the email verification.** `verifyOtp` marks the
  address confirmed, so magic-link users skip the separate confirmation
  round-trip that password signups need. One email instead of two, and no
  unverified-account limbo state.
- **With `shouldCreateUser: true` it doubles as signup.** Signups are
  public anyway (ADR-0014, new accounts start read-only), a fresh account
  gets its profile from the existing `handle_new_user` trigger regardless
  of auth method, and — bonus — the login form stops being an account
  enumeration oracle: the response is "check your email" whether or not
  the address has an account.

## What already exists (do not rebuild)

- **`/auth/confirm` already verifies magic links.** The route takes any
  `token_hash` + `type`, including `magiclink` — it is how local test
  sessions sign in today.
- **The branded email template already ships.**
  `supabase/templates/magic_link.html` (subject "Your sign-in link") is
  wired into local GoTrue via `config.toml` and pushed to production by
  `scripts/push-email-templates.sh` in CI. Its links already point at
  `/auth/confirm?token_hash={{ .TokenHash }}&type=magiclink&next=/app`.
- **SMTP (Mailjet) and the `/check-email` page** — the page is already
  parameterized per flow (`?flow=reset`).

## Work items

1. **Server action** (`apps/web/src/app/login/actions.ts`) — ~25 lines:
   `supabase.auth.signInWithOtp({ email, options: { shouldCreateUser:
   true } })`, then `redirect("/check-email?flow=magic")`. Surface errors
   the same way `login` does (`/login?error=…`). Supabase's built-in
   per-address cooldown (60s between sends) comes back as an error —
   reword it to something human before displaying.

2. **Login page UI** — the form already routes per-button with
   `formAction`, so add a second button ("Email me a sign-in link")
   under the existing one. It must carry **`formNoValidate`**, or the
   `required` password field blocks submission client-side; the action
   simply never reads the password. Same email field serves both buttons.

3. **`/check-email` copy branch** for `flow=magic` ("we sent you a
   sign-in link — it works once and expires in an hour").

4. **Signup page**: add a one-line pointer ("prefer not to have a
   password? use the sign-in link on the login page") or nothing at all.
   Do NOT build a separate magic-link signup — item 1 already is one.

5. **Docs**: PRIVACY.md gains nothing (no new data), but AGENTS.md's
   "Current status" and a short ADR are warranted — the decision worth
   recording is `shouldCreateUser: true` and the enumeration/verification
   reasoning above.

## The passwordless wrinkle (owner's call, decide before building)

An account that only ever signs in by magic link has no password, and two
flows reauthenticate with the current password: **password change** and
**account deletion** (PR #24). Neither locks anyone out — the
forgot-password recovery flow (ADR-0011) works for any account and lets a
passwordless user set a password — but the dead end must be signposted.

- **v1 (recommended): copy hints.** The deletion card and password card
  error paths mention "signed up with a magic link? Set a password via
  'Forgot your password?' first." Zero new auth surface.
- **v2 (follow-up, only if v1 annoys real users): OTP reauth.** Deletion
  offers "email me a confirmation code" (`signInWithOtp` + `verifyOtp`
  with the code, no link) as an alternative to the password. More code,
  more states; not worth it before someone actually hits the dead end.

## Known limitations, accepted

- **The `next` destination does not survive the email round-trip** — the
  template hardcodes `next=/app`. Same accepted tradeoff as signup
  confirmation. (Threading `{{ .RedirectTo }}` through the template is
  possible later; it must pass `safeNext` at the confirm route, which it
  already would.)
- **Local dev sends at most 2 emails/hour** (`auth.rate_limit.email_sent`
  in `supabase/config.toml`) — bump it locally while testing, don't
  commit the bump.

## Testing (all local, no production side effects)

Mailpit (http://127.0.0.1:54324) captures every local auth email. Prove:
new-address send → account created read-only + link signs in + email
already verified; existing-password-account send → same account, password
still works afterwards; expired/reused link → lands on the login error;
the 60s cooldown error reads like English. The e2e technique (drive the
form, fish the link out of Mailpit, follow it) is the same one used for
the reset-password flow.
