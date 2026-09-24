# ADR-0026: Auth calls are limited per visitor, in the Worker

- Status: accepted
- Date: 2026-09-24
- Amends: ADR-0024 (which noted that GoTrue's per-IP limits see Cloudflare's
  addresses, not visitors')

## Context

Every GoTrue call runs server-side, in the Worker. Supabase sits behind
Cloudflare, and Cloudflare gives every request a Worker sends to another
Cloudflare site the same `CF-Connecting-IP`, the fixed Workers address
`2a06:98c0:3600::103`. So GoTrue counts all of stubs.tv as a single client,
and its per-IP limits are really limits for the whole site. That covers
sign-ups and sign-ins, token requests (every session refresh among them) and
email-link verifications.

That matters in two ways. A busy hour of real people can reach those limits
on its own. And one visitor could use an allowance up for everyone else,
because not every one of these calls passes a CAPTCHA first. When a refresh
is refused after the access token has expired, the SDK signs that user out.

Supabase's own answer for server-side callers, forwarding the visitor's
address in `Sb-Forwarded-For`, is honoured only on requests made with a
secret key. GoTrue skips CAPTCHA for admin credentials, so that would mean
verifying Turnstile in the app and putting a service-role credential on the
sign-in path. Cloudflare's WAF rate-limiting rule can't do the job either. On
the zone's Free plan it matches on path only and counts over 10 seconds.
Supabase's allowances are measured over 5 minutes.

## Decision

1. **The Worker counts each visitor before GoTrue sees the call.** The
   Supabase clients built in `lib/supabase/` (server components and
   actions, the middleware, and the service client) get their fetch from
   `lib/auth/rate-limit.ts`. It sorts each GoTrue call into one of the
   allowances Supabase counts per IP: sign-in, sign-up, verification, reset
   and other emails, OAuth code exchange, and refresh. Each call spends one
   unit of the visitor's own counter first. Reading the user, signing out,
   admin calls and all database calls pass straight through.
2. **Visitors are keyed by `CF-Connecting-IP`.** IPv4 is used whole, and
   IPv6 is cut to its /64. Cloudflare overwrites that header on stubs.tv, so
   it can't be forged there. Cloudflare's docs advise against IP keys,
   because addresses can be shared. Before sign-in there is no other
   identity, though, so the limits sit well above what one person needs.
3. **The limits are two Workers Rate Limiting bindings** in `wrangler.jsonc`:
   - `AUTH_ATTEMPTS` allows 10 a minute for each kind of call.
   - `AUTH_REFRESHES` allows 30 a minute. It has to be looser, because any
     signed-in request near the end of a token's hour refreshes it.

   Counts are kept per Cloudflare location and are approximate, which suits
   a guard.
4. **A refused call is answered in the Worker** with a 429 in GoTrue's error
   shape and our own code, `visitor_rate_limited`. Every caller sees an
   ordinary auth error. The forms ask the visitor to wait a minute. The
   confirm and reset links stay usable, since their token was never spent.
   GoTrue's own rate-limit errors are handled as before. The reset form
   still hides them, because GoTrue's per-address limit would show which
   addresses have accounts.
5. **It fails open.** Calls go through if there's no binding (Node
   self-hosting), no visitor address (background work, or `next dev`
   without the header), or if the limiter itself errors.

## Consequences

- One visitor can no longer spend Supabase's site-wide allowances alone.
  That holds only while those allowances stay well above one visitor's
  share, so the hosted limits must be raised (DEPLOYMENT.md §1c).
- If a refresh is refused after the access token has expired, the session
  ends, just as when GoTrue refuses it. At 30 a minute, only automated
  traffic should get there.
- Every Supabase client must come from `lib/supabase/`, or its calls skip
  the limiter (AGENTS.md).
- Node deployments (ADR-0021) get no per-visitor limit. If they use hosted
  Supabase, their GoTrue sees the server's one address, with the same
  site-wide effect. SELF-HOSTING.md says so.
