# ADR-0024: Auth forms carry a Turnstile token, and Supabase enforces it

- Status: accepted
- Date: 2026-09-23

## Context

Every auth email draws from one project-wide budget (custom SMTP, 30 an
hour), and GoTrue's public endpoints for sign-up, password sign-in,
recovery, resend, OTP and magic links answer anyone who has the project URL
and publishable key. A script asking `/recover` for one address every
minute, or signing up random ones, blocks confirmation and reset mail for
everyone and burns the domain's sending reputation. GoTrue's per-IP limits
barely help: the app calls GoTrue from the Worker, so those limits see
Cloudflare's addresses, not visitors' (ADR-0026 adds per-visitor limits in
the Worker for that reason). CAPTCHA on those endpoints is GoTrue's own
answer, and it must be enforced by GoTrue, because the endpoints can be
called without going through the app at all.

## Decision

1. **Supabase enforces CAPTCHA with Cloudflare Turnstile** (Authentication
   → Bot and Abuse Protection). GoTrue then requires a token on `/signup`,
   `/token` with the password grant, `/recover`, `/resend`, `/otp` and
   `/magiclink`. It exempts the pkce, refresh_token and id_token grants
   (the OAuth callback and session refresh) and any request made with admin
   credentials. The widget is created without pre-clearance, which would
   let one solved widget skip Cloudflare's own challenge rules.
2. **The anonymous forms carry the widget.** Login, sign-up and
   forgot-password render `components/auth/Turnstile.tsx`, which writes its
   token into a hidden `captcha_token` field; the server actions pass it on
   as `captchaToken`. A refused token shows a fixed message
   (`lib/auth/captcha.ts`), and forgot-password reports it instead of
   swallowing it, since it says nothing about whether the address exists.
   The widget runs invisibly (`interaction-only`) in the app's own light or
   dark theme, and only opens, animated, when Cloudflare wants a click. A
   submit that beats the invisible check waits for the token (up to 8s)
   instead of failing.
3. **Signed-in GoTrue calls use the service client**: the settings password
   email and delete-account's password check. Both sit behind a session
   that already passed a human check at sign-in (or came from an OAuth
   provider), so the admin exemption costs nothing, and a widget in the
   settings card would only be clutter.
4. **The site key is a runtime var, `TURNSTILE_SITE_KEY`**, public by
   design and set in `wrangler.jsonc`. Without it the widget renders
   nothing, which is right wherever CAPTCHA is off in Supabase: local dev
   (off in `supabase/config.toml`) and self-hosted instances that haven't
   opted in.
5. **Roll out app first, then Supabase.** GoTrue ignores tokens while
   CAPTCHA is off, so shipping the widget first is harmless; enabling
   CAPTCHA first would refuse every sign-in until the app caught up.
   Turning it off again goes in the opposite order.

## Consequences

- One Cloudflare script (`challenges.cloudflare.com`) runs on the three
  auth pages. Cloudflare already terminates TLS and runs the Worker, so no
  new party gains access to those pages.
- While CAPTCHA is on, visitors without JavaScript can't sign in, sign up or
  reset a password. OAuth sign-in isn't gated: the provider is the human
  check there.
- `lib/settings/actions.ts` gains two service-role calls, listed in
  AGENTS.md.
- Tokens are single-use and expire after five minutes. Turnstile refreshes
  them while the page is open, and every failed submit redirects to a fresh
  render with a new widget.
- Testing locally uses Cloudflare's always-pass test pair: the site key via
  the `web-turnstile` launch config, the secret in the commented
  `[auth.captcha]` block of `supabase/config.toml` (restart the stack after
  uncommenting it).
