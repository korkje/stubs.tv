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

### 1b. Supabase auth configuration (dashboard)

Hosted projects require email verification on signup (unlike local dev,
where `supabase/config.toml` disables it). Configure once under
*Authentication*:

- **URL Configuration** → Site URL: `https://stubs.tv`. Add
  `http://localhost:3000/**` to additional redirect URLs.
- **Email Templates → Confirm signup**: point the link at our confirm
  route, which verifies the token and signs the user in:

  ```html
  <a href="{{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=email">
    Confirm your email
  </a>
  ```

Without the template change, the default link still verifies the account,
but drops the user on the homepage unauthenticated — they'd have to sign in
manually afterwards.

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

## Runtime secrets (later phases)

Server-only secrets (e.g. `TVDB_API_KEY` in Phase 1) are **Cloudflare worker
secrets**, not GitHub build-time env:

```sh
npx wrangler secret put TVDB_API_KEY   # one-time, from a trusted machine
```

Build-time env in the workflow is only for `NEXT_PUBLIC_*` values that
Next.js inlines into the bundle.

## Rollback

Workers keep previous versions: dash → Workers → stubs → Deployments →
roll back. Database migrations are forward-only — write a new migration to
undo a bad one.
