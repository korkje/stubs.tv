# Self-hosting stubs.tv

stubs.tv is fair source (FSL-1.1-Apache-2.0): you may run your own
instance for yourself, your household, or your organisation for free, and
`SELF_HOSTED=true` removes the paywall entirely (ADR-0019). This page is
the walkthrough; ADR-0021 records the design.

What you run:

| Piece | What it is | Where it runs |
|---|---|---|
| **web** | The Next.js app, one container from the `Dockerfile` here | Your Docker host |
| **Supabase** | Postgres + Auth, reached over its API | A free project at supabase.com, or your own Supabase |
| **TheTVDB** | Metadata source; you need your own v4 API key | External |
| **SMTP** | Sends sign-up/confirmation/reset emails | Any provider; optional for a single-user box (see step 3) |

Nothing else. The hourly metadata refresh and the import worker run inside
the web container (`INTERNAL_CRON=true`, set by the compose file).

## 1. Supabase project

**Hosted (simplest).** Create a project at supabase.com — pick the region
closest to you. From *Settings → API* note the **project URL**, the
**anon key** and the **secret (service_role) key**; from the project URL
note the **project ref**.

**Self-hosted Supabase.** Follow Supabase's own Docker guide. You then have
the same three values (`API_EXTERNAL_URL`, `ANON_KEY`, `SERVICE_ROLE_KEY`
in its `.env`) plus a direct Postgres URL for the migrations below.

### Apply the schema

Migrations live in `supabase/migrations/`. Apply them with the Supabase
CLI (needs Node ≥24; `npx` fetches the CLI):

```sh
git clone https://github.com/korkje/stubs.tv.git && cd stubs.tv
npx supabase link --project-ref <project-ref>   # hosted: prompts for the DB password
npx supabase db push
```

For self-hosted Supabase skip `link` and push straight to the database:

```sh
npx supabase db push --db-url 'postgresql://postgres:<password>@<host>:5432/postgres'
```

Re-run `npx supabase db push` after every `git pull`; it applies only
what is new. Do **not** run `supabase db reset` against your instance —
that is the local-development command and it wipes the database.

### Auth settings

In the Supabase dashboard under *Authentication → URL Configuration*
(or the matching `GOTRUE_*` env for self-hosted Supabase):

- **Site URL**: where your instance will be reached, e.g.
  `https://stubs.example.com` — confirmation links are built from it.
- **Redirect URLs**: add `https://stubs.example.com/**`.

## 2. TheTVDB API key

Metadata comes from TheTVDB v4. Register a project at
<https://thetvdb.com/api-information> — free for projects under $50k/yr
revenue, attribution required (the app's footer carries it; leave it in
place, it is a licence term). You get one API key; that is `TVDB_API_KEY`.

## 3. Email

Supabase Auth sends confirmation, magic-link and password-reset emails.
Two ways to go:

- **Configure SMTP** (*Authentication → Emails → SMTP settings*) with any
  provider that does **not** rewrite links for click tracking (it breaks
  the confirm flow — ADR-0009). Then push this repo's email templates,
  which route the links through `/auth/confirm`, where one click signs the
  user in:

  ```sh
  SUPABASE_ACCESS_TOKEN=<token from supabase.com/dashboard/account/tokens> \
  SUPABASE_PROJECT_ID=<project-ref> \
  scripts/push-email-templates.sh
  ```

  On self-hosted Supabase point the `GOTRUE_MAILER_TEMPLATES_*` variables
  at the files in `supabase/templates/` instead (the subjects are listed
  at the top of that script).

- **Skip email entirely** for a personal box: turn off *Confirm email*
  under *Authentication → Sign In / Up → Email*. Accounts are then live
  immediately on sign-up, and the sign-up form asks for the password itself
  (with mail on, the password is chosen from the confirmation link instead,
  ADR-0025). Password reset and magic links will not work,
  and anyone who can reach the sign-up page can create an account — keep
  the instance behind your own auth or network if you do this.

If the instance is reachable from the internet, consider a bot check on the
sign-in, sign-up and reset forms (ADR-0024): create a Cloudflare Turnstile
widget, set its site key as `TURNSTILE_SITE_KEY` in `.env` (read at runtime,
so a restart is enough), then enable CAPTCHA with provider Turnstile and the
widget's secret key under *Authentication → Bot and Abuse Protection*. Set
both halves or neither.

## 4. Run it

```sh
cp .env.example .env
$EDITOR .env            # the four keys from steps 1–2, plus a random CRON_SECRET
docker compose up -d --build
```

The first build takes a few minutes (it installs dependencies and runs
`next build`). Then open `http://<host>:3000`, sign up, and start
following shows. The image is built for *your* Supabase project — the
URL and anon key are baked into the bundle at build time — so rebuild
after changing them.

Put it behind your usual reverse proxy for TLS, forwarding the standard
`X-Forwarded-Host` and `X-Forwarded-Proto` headers (Caddy, Traefik and
Nginx Proxy Manager do by default) — sign-in redirects are built from
them. Set `STUBS_PORT` in `.env` to change the published port.

### Updating

```sh
git pull
npx supabase db push
docker compose up -d --build
```

### Checking the background jobs

The container logs `internal cron: …` on boot. Followed shows refresh
hourly (first run one minute after boot) and TV Time imports are swept
every five minutes. To poke either by hand:

```sh
curl -H "x-cron-key: $CRON_SECRET" http://localhost:3000/api/refresh
```

## Without Docker

The image is just `next build` + `node server.js`. On any Node ≥24 host:

```sh
npm ci
NEXT_PUBLIC_SUPABASE_URL=… NEXT_PUBLIC_SUPABASE_ANON_KEY=… SELF_HOSTED=true npm run build
```

then run `apps/web/.next/standalone/apps/web/server.js` with the same
variables plus `SUPABASE_SECRET_KEY`, `TVDB_API_KEY`, `CRON_SECRET`,
`INTERNAL_CRON=true`, `PORT` and `HOSTNAME`, after copying
`apps/web/.next/static` to `.next/standalone/apps/web/.next/static` and
`apps/web/public` alongside it (the Dockerfile does exactly this).

## What the flag changes

With `SELF_HOSTED=true` every signed-in account has full access, and the
pricing page, billing settings and checkout routes are hidden (ADR-0019).
Nothing else differs from stubs.tv. Your data is yours in the literal
sense — it is in your Postgres — and the in-app JSON export and account
deletion (ADR-0017) work the same.

## Getting help

Open an issue at <https://github.com/korkje/stubs.tv/issues>. Include the
container logs (`docker compose logs web`) and the error digest shown on
the page if there is one.
