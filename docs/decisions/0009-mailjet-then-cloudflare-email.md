# ADR-0009: Mailjet for transactional email; migrate to Cloudflare Email Service later

- Status: accepted — migration to Cloudflare Email Service completed 2026-08-29
- Date: 2026-08-10
- Supersedes: ADR-0008 (Brevo)

## Context

Brevo (ADR-0008) turned out to wrap every link in transactional emails
with its click-tracking redirect domain (`sendibt*.com`), with no way to
disable it for SMTP — a long-standing, explicitly declined feature request.
The domain mismatch landed our verification emails in spam, which breaks
signup. Auth emails need untouched links above all else.

Meanwhile, Cloudflare launched **Email Service** (public beta April 2026):
transactional sending via Workers binding, REST API, or plain SMTP
(`smtp.mx.cloudflare.net:465`), with 3,000 emails/month included on
Workers Paid ($0.35/1k after). We already host on Cloudflare and plan to
move to Workers Paid anyway (ADR-0002).

## Decision

1. **Now: Mailjet** (EU-based, free tier ample) with click/open tracking
   disabled, so verification links stay exactly as written.
2. **Later: migrate to Cloudflare Email Service** once we are on the
   Workers Paid plan and the service is GA. Supabase talks SMTP, so the
   migration is a credentials swap in the Supabase dashboard plus DNS
   records — no code change. One fewer vendor, one fewer GDPR processor.

## Consequences

- Sender domain `stubs.tv` authenticated (SPF/DKIM) for Mailjet in
  Cloudflare DNS; those records get replaced at migration time.
- Verify after any provider change: signup email lands in inbox (not
  spam), and the confirm link points directly at
  `stubs.tv/auth/confirm` — no tracking redirect.
- Tracked in ROADMAP icebox: "Migrate auth email to Cloudflare Email
  Service".
- Lesson recorded for future provider choices: transactional email
  providers must allow disabling link rewriting — check before adopting.
