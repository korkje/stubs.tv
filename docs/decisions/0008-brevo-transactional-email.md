# ADR-0008: Brevo for transactional email (custom SMTP)

- Status: superseded by ADR-0009
- Date: 2026-08-10

## Context

Supabase's built-in email service is explicitly for testing: email
templates cannot be customized without custom SMTP, and the rate limit
(a few emails/hour) blocked even basic signup testing. Our /auth/confirm
sign-in-on-verify flow requires a template change, so custom SMTP is
mandatory, not optional.

Candidates: Resend (best DX, US company, 3k/month free), Brevo (EU-based,
300/day free), AWS SES (cheapest at scale, most ceremony).

## Decision

Brevo, chosen primarily for being EU-based — the cleanest GDPR story for a
processor that handles user email addresses (see docs/PRIVACY.md). Auth
email volume is small enough that provider DX differences barely matter,
and SMTP is a commodity interface — switching later is a dashboard change,
not a code change.

## Consequences

- Sender domain `stubs.tv` authenticated via DKIM/DMARC records in
  Cloudflare DNS; sender address `no-reply@stubs.tv`.
- Supabase email rate limits become configurable (default 30/hr with
  custom SMTP).
- Brevo listed as a processor in docs/PRIVACY.md and, later, the privacy
  policy page.
- Setup steps live in docs/DEPLOYMENT.md § 1b.
