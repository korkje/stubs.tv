# Security policy

## Reporting a vulnerability

Please report vulnerabilities **privately** — do not open a public issue.

- Preferred: [GitHub private vulnerability reporting](https://github.com/korkje/stubs.tv/security/advisories/new)
  ("Report a vulnerability" under the Security tab).
- Or email **security@stubs.tv**.

Include what you found, where (URL, endpoint, or file), and how to
reproduce it. You'll get an acknowledgement within a few days; this is a
one-person project, so please allow a reasonable window for a fix before
any disclosure.

## Scope

- The application at **stubs.tv** and the code in this repository.
- Out of scope: denial-of-service, rate-limit probing against the live
  site, social engineering, and issues in third-party services (Supabase,
  Cloudflare, Polar, TheTVDB) — report those upstream.

Please test against a local instance (see the README's "Running locally")
rather than the production site wherever possible.
