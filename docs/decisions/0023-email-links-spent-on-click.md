# ADR-0023: Email links land on a page; the token is spent on a click

- Status: accepted
- Date: 2026-09-23
- Amends: ADR-0011 (whose Consequences kept `type=recovery` working on `/auth/confirm`)

## Context

ADR-0011 moved recovery links onto a form that spends the token on submit.
Every other auth email (sign-up confirmation, magic link, email change)
still linked to `/auth/confirm`, a route that called `verifyOtp` on GET
and signed the browser in. That left two problems:

- **Prefetching burns tokens.** Mail clients and security scanners fetch
  links before the recipient does. A scanner's GET signed *it* in and spent
  the token, and the person's own click then failed as "invalid or
  expired". ADR-0011 named this for recovery; it applies to every link.
- **Any page could sign a visitor into someone else's account.** Nothing
  ties a token to the browser that asked for it. Someone could request a
  link for their own account and get another person's browser to open it,
  with no click on our side. That person would then be using, and adding
  history to, an account they don't own. If they connected Google from
  settings in that state, the identity would join the wrong account for
  good (manual linking is on; see docs/DEPLOYMENT.md).

`/auth/confirm` also accepted any `type`, including `recovery`, which
signs the user in without the new-password form ADR-0011 exists for.

## Decision

1. **`/auth/confirm` is a page, not a route handler.** A GET renders one
   button; the `confirmEmailLink` server action spends the token and
   redirects to `next` (through `safeNext`). The URL and its parameters
   are unchanged, so the templates and any mail already sent keep working.
2. **Only the types the templates send are accepted:** `email`,
   `magiclink`, `email_change` (`lib/auth/email-links.ts`, with a test that
   reads `supabase/templates/`). Recovery is refused here and belongs to
   `/auth/reset-password` alone.
3. **The page names the current session.** A visitor who is already signed
   in is told which account that is, and that continuing may switch
   accounts. Settings shows "Signed in as" above the Connect buttons for
   the same reason.

## Consequences

- One more click for confirmation and magic links.
- A scanner's GET no longer spends anything. Server actions refuse
  cross-origin posts, so spending a token always takes a click on our own
  page; another site can at most show someone that page.
- The page can't say which account a link is for without spending it.
  Someone who isn't signed in only sees "Sign in", so the protection
  against being handed another person's link is the extra, visible step,
  not a warning.
- Tooling that signed in by GETting `/auth/confirm` (local testing
  scripts) now has to submit the form as well.
