# Deployment

**All production deploys happen from GitHub Actions** — never from a local
machine. Every push to `main` runs: checks → Supabase migrations
(`supabase db push`) → Cloudflare Workers deploy (OpenNext build + wrangler).
A deploy can also be triggered manually from the Actions tab
(workflow_dispatch). Local `npm run deploy` exists only as a break-glass
escape hatch.

## One-time setup (owner)

### 1. Hosted Supabase project

Create a project at supabase.com — **region: EU (e.g. Frankfurt)** (GDPR,
see docs/PRIVACY.md). Note the project ref (in the project URL), the
database password, and from *Settings → API* the project URL and anon key.

### 1b. Auth emails: custom SMTP via Cloudflare Email Service (ADR-0009)

Supabase's built-in email service is testing-only: templates can't be
edited and it's rate-limited to a handful of emails per hour. Custom SMTP
unlocks both. We use Cloudflare Email Service (3k emails/month included
with Workers Paid, ADR-0016; migrated from Mailjet 2026-08-29).

> Do not use a provider that force-wraps links in tracking redirects
> (Brevo does, with no off switch — ADR-0008/0009): the redirect-domain
> mismatch sends verification emails to spam.

1. Cloudflare dashboard → Email Service → add `stubs.tv` as a sender
   domain. The wizard creates the DNS records in the zone automatically:
   DKIM keys (`cf-bounce._domainkey`, `cf2024-1._domainkey`) and a
   bounce/envelope subdomain `cf-bounce.stubs.tv` with its own SPF record.
   The apex SPF record is Email Routing's (inbound forwarding), not this.
2. Create SMTP credentials in Email Service; server
   `smtp.mx.cloudflare.net`, port `465`.
3. Supabase dashboard → *Authentication → Emails → SMTP settings* → enable
   custom SMTP with sender `noreply@stubs.tv` (name "stubs.tv") and the
   Cloudflare credentials.
4. *Authentication → Rate Limits* → raise the email rate limit (default
   with custom SMTP is 30/hr — fine to start).
5. Verify: sign up with a fresh address; the mail must land in the inbox
   and the confirm link must point directly at `stubs.tv/auth/confirm`.
   For a full deliverability check, sign up with a throwaway address from
   mail-tester.com and check the score (2026-08-29 baseline: SPF, both
   DKIM signatures, and DMARC all pass; deductions only for the default
   invite template, which we don't customize or send).

### 1c. Supabase auth configuration (dashboard)

Hosted projects require email verification on signup (unlike local dev,
where `supabase/config.toml` disables it). Configure once under
*Authentication*:

- **URL Configuration** → Site URL: `https://stubs.tv`. Add
  `http://localhost:3000/**` **and `https://stubs.tv/auth/callback`** to
  additional redirect URLs — GoTrue validates OAuth `redirectTo` against
  this list and *silently falls back to the Site URL* on a miss, which
  strands the sign-in with an unexchanged code on the homepage.
- **Sign in with Google/Apple** (docs/plans/oauth-login.md): enable both
  providers under *Authentication → Sign In / Up* with their client ids
  (Google's secret by hand; Apple's secret is written and rotated by the
  ops repo's scheduled workflow). Turn on **"Allow manual linking"** — the
  settings page's Connect buttons need it. Which providers the UI offers is
  the `AUTH_PROVIDERS` var (wrangler.jsonc / .env.local).
- **Email templates are managed in the repo — do not edit them in the
  dashboard** (edits would be overwritten on the next deploy). The HTML
  lives in `supabase/templates/`, wired up for local dev in
  `supabase/config.toml`, and CI pushes it to the hosted project via the
  Management API (`scripts/push-email-templates.sh`). Confirmation and
  magic-link mails go through `/auth/confirm?token_hash={{ .TokenHash }}&type=…`,
  which verifies the token and signs the user in — a plain link would verify
  the account but drop the user on the homepage unauthenticated. Recovery is
  the exception: it links to `/auth/reset-password?token_hash=…`, which shows
  the new-password form and only spends the token on submit (ADR-0011).
- Editing a template locally does not reach a running stack — GoTrue reads
  them at boot. `docker restart supabase_auth_<project>` picks them up.

Stuck during testing (rate-limited, unverified account)? The hourly limit
resets on its own, and a user can be confirmed manually from
*Authentication → Users*. Recovery mail shares the same custom-SMTP hourly
budget as signup mail.

### 2. Cloudflare API token

dash.cloudflare.com → My Profile → API Tokens → Create Token → use the
**"Edit Cloudflare Workers"** template (includes Workers Scripts edit +
Workers Routes for the custom domain). Scope it to the account and the
stubs.tv zone. Also note the Account ID (dashboard sidebar).

### 3. Supabase access token

supabase.com/dashboard/account/tokens → Generate new token (used by the CLI
in CI to link the project and push migrations).

### 4. GitHub repo secrets and variables

```sh
gh secret set CLOUDFLARE_API_TOKEN        # from step 2
gh secret set CLOUDFLARE_ACCOUNT_ID       # from step 2
gh secret set SUPABASE_ACCESS_TOKEN       # from step 3
gh secret set SUPABASE_PROJECT_ID         # project ref from step 1
gh secret set SUPABASE_DB_PASSWORD        # from step 1

gh variable set NEXT_PUBLIC_SUPABASE_URL       # https://<ref>.supabase.co
gh variable set NEXT_PUBLIC_SUPABASE_ANON_KEY  # anon key (public by design)

gh variable set DEPLOY_ENABLED --body true     # unlocks the migrate/deploy jobs
```

Until `DEPLOY_ENABLED` is `true`, pushes to main only run the checks job —
so CI stays green during initial setup.

The Supabase URL and anon key are repo *variables*, not secrets — the anon
key ships to every browser anyway; RLS is the security boundary.

### 5. First deploy

Push to `main` (or run the CI workflow manually). The first successful
deploy creates the `stubs` worker and attaches the `stubs.tv` custom domain
(configured in `apps/web/wrangler.jsonc`).

## Runtime secrets

Server-only secrets are **Cloudflare worker secrets**, not GitHub build-time
env. Set from `apps/web/`, one-time, from a trusted machine:

```sh
npx wrangler secret put TVDB_API_KEY         # TheTVDB v4 API key
npx wrangler secret put SUPABASE_SECRET_KEY  # Supabase secret (service_role) key
npx wrangler secret put CRON_SECRET          # any long random string; guards /api/refresh
```

The first two are required from Phase 1: metadata search and title pages
return a server error without them. `CRON_SECRET` guards the hourly
metadata-refresh route the worker's cron trigger invokes (ADR-0010);
without it the cron runs but the route rejects it. `SUPABASE_SECRET_KEY` grants full database access
(it bypasses row level security), so it must never become a GitHub variable
or reach the browser.

Build-time env in the workflow is only for `NEXT_PUBLIC_*` values that
Next.js inlines into the bundle.

## Rollback

Workers keep previous versions: dash → Workers → stubs → Deployments →
roll back. Database migrations are forward-only — write a new migration to
undo a bad one.
