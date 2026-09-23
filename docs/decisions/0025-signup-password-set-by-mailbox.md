# ADR-0025: Sign-up sets the password through the mailbox

- Status: accepted
- Date: 2026-09-24
- Amends: ADR-0023 (whose sign-up confirmation page was a single button)

## Context

When a sign-up hits an address that already has an unconfirmed account,
GoTrue re-sends the confirmation mail but keeps that account's existing
password ("we can't be sure of their claimed identity"). So anyone who
knows an address can register it first with a password of their own. When
the real owner later signs up and confirms, they are using an account the
other person can sign in to, and linking that person's own Google account
would keep them in even after a reset.

Only the confirmation mail proves who controls the address, so the
password has to be set there. That is the rule ADR-0011 already applies to
password resets: every password is set through a mailbox round trip.

## Decision

1. **With confirmation mail on, sign-up asks only for the email.** GoTrue
   still requires a password, so it gets a random throwaway
   (`lib/auth/password.ts`) that nobody ever sees.
2. **The sign-up confirmation page asks for the password.** `/auth/confirm`
   with `type=email` shows a password field. The action checks the length
   before spending the token, as the reset flow does, then runs
   `verifyOtp`, then `updateUser({ password })`. Whoever controls the
   mailbox sets the password, replacing whatever sign-up stored.
3. **Without confirmation mail the form keeps the password.** Local dev and
   self-hosted instances without SMTP have no mail to move it to. Which
   mode applies is read from GoTrue's public `/settings`
   (`mailer_autoconfirm`) and cached per isolate for five minutes
   (`lib/auth/signup-mode.ts`), so nobody has to configure it. If GoTrue
   can't be asked, the form shows the password field. That is safe in
   either mode, because a confirmation link still asks for the password.
4. **A refused password after the token is spent** (for example a hosted
   policy stricter than `MIN_PASSWORD_LENGTH`) can't go back to the form.
   The user is confirmed and signed in, and lands on settings, whose Set up
   button mails a fresh link to choose another.

## Consequences

- Registering an address first no longer gives anyone a way in: the
  password that counts is the one chosen after the owner's own click.
- New users type their password on the page the email link opens, not on
  the sign-up form. Google and Apple sign-up are unchanged.
- Unconfirmed sign-ups from before this change are also asked for a
  password when they confirm, and may choose the same one again.
- In production, the sign-up page makes one extra request to GoTrue per
  isolate every five minutes.
