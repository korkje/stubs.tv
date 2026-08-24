# Plan: import from TV Time exports

Status: **shipped 2026-08-19** (same day the plan settled — see ADR-0015
for the client-side-parsing rule and ADR-0016 for Workers Paid, which
resolved §4a; §9 was decided as recorded below). This document stays as the
format reference: the column semantics under "What the export actually is"
are the source of truth the parser and its fixtures were built from, and
they cannot be re-derived — no new export can ever be generated.

What shipped: `packages/tvtime-import` (pure parser + fixtures + tests),
the `/import/tv-time` public preview and `/app/import` flow, phase-1
commit (`apps/web/src/lib/import/actions.ts`), the phase-2 worker
(`/api/import/run` on a 5-minute cron), the reconciliation report, the
manual film resolver, and 429 backoff in TvdbClient. Data export and
self-serve deletion shipped 2026-08-20 (ADR-0017); the one launch
prerequisite still open is getting one real redacted export to validate
against before any launch post.

## Why this is worth doing

TV Time shut down on **2026-07-15** and deleted all user data. It had ~26M
users. Before it closed it ran a self-service GDPR export at
`gdpr.tvtime.com`, so a large number of people are sitting on a
password-protected ZIP containing years of watch history and no home for
it.

The reason this is *our* opportunity rather than everyone's: **TV Time and
TheTVDB were both Whip Media properties, and the export is keyed by
TheTVDB ids.** stubs.tv is TheTVDB-native (ADR-0004). Trakt, Simkl,
Moviebase, TVmaze and Refract all shipped TV Time importers, and every one
of them has to *translate* TVDB ids into its own catalogue and ask the
user to disambiguate what it can't match. We don't. For shows and
episodes our import is an exact join, not a guess.

That is the entire marketing claim, and it happens to be true:

> Your TV Time export is already in our ids. Shows and episodes import
> exactly — no matching, no guessing, nothing to confirm.

### Timing, honestly

The shutdown was five weeks ago and the migration wave mostly already
happened. We are not first and should not pretend to be. What is left is
the long tail: people who downloaded the ZIP in a panic, never picked a
replacement, and still have the file. That tail is real but it is not
26M people, and it shrinks every week. If this ships, it should ship
soon, and the Reddit post should lead with *exactness* and
*self-hosting/FSL* (r/selfhosted, r/DataHoarder care about both) rather
than with being a TV Time replacement, of which there are now many.

Nobody can generate a new export — the portal is gone. Only files people
already have exist.

Two corrections to the obvious go-to-market:

- **A post is a spike; search traffic is the tail.** People still turn up
  months later googling "import TV Time export". A durable public
  `/import/tv-time` page carrying the free client-side preview is worth
  more than the post, and because parsing happens in the browser it can
  demo the whole thing to a logged-out stranger.
- **r/selfhosted and r/DataHoarder convert to self-hosters, not
  subscribers** — the FSL guarantees it, deliberately. Good for awareness
  and contributions; don't count them toward the ~15 annual subscribers
  that clear the cost floor.

## What the export actually is

**Verified** against three independent open-source parsers, one of which
documents its findings as "real formats, inspected 2026-07-06", plus a set
of committed fixtures (see Samples below). Where they disagreed I took the
2026-07-06 reading.

A password-protected ZIP (ZipCrypto or AES; TV Time mailed the password in
a **separate** email from the download). Inside: a flat pile of CSVs. Not
all accounts got all files — the parser must treat sources as a priority
list and report which one it used.

### The five files that matter

`followed_tv_show.csv`
```
tv_show_id,active,diffusion,notification_type,folder_id,archived,user_id,
updated_at,notification_offset,tv_show_name,created_at
121361,1,,,,0,,,,Game of Thrones,2018-02-22 03:05:02
```
`tv_show_id` **is the TheTVDB series id** — 121361 is Game of Thrones on
TheTVDB. `archived` is "0"/"1".

`tracking-prod-records-v2.csv` — the canonical watch history. One row per
watched episode, discriminated by the `key` column's prefix:
```
ep_id,series_name,ep_no,s_no,user_id,episode_id,created_at,key,gsi,
season_number,s_id,runtime,episode_number,ep_watch_count,updated_at,
movie_watch_count,total_movies_runtime,series_follow_count,
total_series_runtime,is_followed,uuid,followed_at,is_for_later,
is_archived,most_recent_ep_watched,is_unitary,rewatch_count,is_special,
bulk_type
3254641,Game of Thrones,1,1,,3254641,2019-01-01 10:00:00,
watch-episode-121361-1-1,,1,121361,,1,,,,,,,,,,,,,,0,,
```
- `key` prefix `watch-episode-` / `rewatch-episode-` → a real watch.
  `user-series-` → per-show state (`is_followed`/`is_archived`/
  `is_for_later`, "true"/"false"). Everything else (`count-*`,
  `last-episode-watched`, `time-count`) is an aggregate — skip it.
- `s_id` = TheTVDB **series** id. `episode_id`/`ep_id` = TheTVDB
  **episode** id, but it is **not always populated** — every mature
  implementation keys on `(s_id, season_number, episode_number)` instead,
  and so should we.
- `created_at` "YYYY-MM-DD HH:MM:SS" is the watch time.
- Duplicate `(season, episode)` rows are rewatches.

`tracking-prod-records.csv` — **movies** (and a v1 copy of episodes; v2 has
~35% more episodes, so prefer v2 and fall back to v1 only if v2 is absent).
```
series_id,user_id,type,updated_at,created_at,series_name,watch_count,uuid,
type-uuid-n,watches,release_date_range_key,entity_type,follow_date_range_key,
movie_name,release_date,alpha_range_key,runtime,rewatch_count,episode_id,
series_uuid,watch_date,episode_number,season_number,total_movies_runtime,
total_series_runtime,country,watch_date_range_key,unitarian,
watched_episode_range_key,bulk_type
,,watch,,2022-03-03 20:00:00,,,,,,,movie,,Inception,2010-07-15 00:00:00,,8880,,,,,,,,,,,,,
```
- Filter `entity_type == "movie"`, `type` in watch|follow|towatch. There is
  a stray `type=rewatch_count` row — ignore it.
- **`watch_date` is empty on every watch row in real exports** — use
  `created_at`.
- `release_date` "0001-01-01" means unknown. `runtime` is in **seconds**.
- **No external ids for movies at all.** Title + year is all we get. This
  is the one genuinely hard part of the import.

`user_tv_show_data.csv` — `tv_show_id`, `nb_episodes_seen`, `is_followed`,
`is_favorited`. TV Time's own per-show seen counter. **Use it to validate**
(see work item 6). `is_favorited` is reportedly always 0 in real exports;
real favourites live in the `favorite-series` / `favorite-movies` entries
of `lists-prod-lists.csv`.

`tv_show_rate.csv` — `tv_show_id` + `rating`, the user's star rating of a
show. The only clean numeric rating in the export.

### Files to be aware of but not import

- `lists-prod-lists.csv` stores each list as a **Go `fmt`-serialised map**,
  not JSON. Item references are recoverable with `/id:(\d+)\s+type:(\w+)/`.
  Only worth touching if we want favourites.
- `ratings-*-votes.csv` / `emotions-*.csv` are **not** numeric ratings.
  `vote_key` is `{entity_id}-{user_id}-{reaction_key}` and the reaction
  keys are a three-value emoji scale (3 = "Wow", 27 = "Good", 29 = "Meh").
  See work item 7 — I recommend not importing these.
- **Never read** `user.csv`, `user_personal_data.csv`, `access_token.csv`,
  `refresh_token.csv`, `auth-prod-login.csv`, `ip_address.csv`,
  `device_*.csv`, `user_session.csv`, `*facebook*`, `*social*`,
  `ad_identifier.csv`. The ZIP contains the user's **password hash, live
  auth tokens, and IP history**. This is the single most important fact in
  this document and it drives work item 1.

### Format-generation risk

Trakt's forum has reports that some GDPR exports were **JSON-only, zero
CSVs** — evidently an earlier (2025, email-requested) generation. Every
tool built for the 2026 shutdown, including one that inspected a real
export nine days before the lights went out, parses CSV. So: build CSV
first, and if a ZIP contains no recognised CSV, **say so explicitly**
rather than importing nothing and reporting success. If a real JSON export
turns up, add it then.

Worth supporting cheaply alongside CSV: the **"TV Time Liberator" JSON**
that the TV Time Out browser extension produced. It is strictly better
input — it carries TVDB *and* IMDb ids, includes movies' TVDB ids, and
lists unwatched episodes — and it normalises to the same internal shape:
```json
{ "uuid": "...", "id": { "tvdb": 366529, "imdb": "tt10574236" },
  "title": "Station Eleven", "status": "stopped",
  "seasons": [ { "number": 1, "episodes": [
    { "id": { "tvdb": 8815687, "imdb": "tt10579918" }, "number": 1,
      "special": false, "is_watched": true,
      "watched_at": "...", "rating": null } ] } ] }
```

## Samples — the answer to "can we test on real data"

Short version: **no real export is publicly available and none can be
created any more**, but we do not need one to build this.

1. **MIT-licensed synthetic fixtures exist** in `brentmid/tv-tracker` at
   `tests/fixtures/tvtime_export/` — all four core CSVs with the genuine
   headers and rows exercising the awkward cases (a rewatch, an episode
   with no `ep_id`, a malformed row, a `user-series-` state row, an
   unknown `0001-01-01` release date). Every header quoted in this
   document came from there or from parser source, so the fixtures can be
   rebuilt from this file alone if that repo disappears.
2. **Three independent parsers to cross-check against**, all MIT:
   `brentmid/tv-tracker` (Python; closest to what we are building — a
   self-hosted tracker with a three-phase inspect/dry-run/commit importer),
   `jeremy-albinet/tvtime-to-refract-converter` (JS; the cleanest written
   spec, with the discriminator rules verified against a real export), and
   `SteadfastKnight/tvtime-time-machine` (Python). `Portvgal/tv-time-capsule`
   covers the long-tail files. Where two of them agree on a column, that
   column is real.
3. **What to actually do**: build synthetic fixtures in-repo from the
   column lists above (they are complete), covering the edge cases in (1)
   plus: a show TheTVDB has since renumbered, a specials-only season, a
   title with a comma and one with a quote, an empty `episode_id`, and a
   movie with a `0001-01-01` date.
4. **Then get one real redacted export — before the launch, not during
   it.** We cannot both claim "import works" and ask for the first real
   sample in the same post. Sequence it: ask quietly first, in the existing
   TV Time migration threads on Reddit and in the issue trackers of the
   tools listed above ("building an importer, will anyone share an export
   with the token/IP/user files deleted?"), validate against
   `nb_episodes_seen` (work item 6), *then* launch.

## Design

### 1. Parse in the browser. Never upload the ZIP. (not negotiable)

Three independent reasons, any one of which is sufficient:

- **Privacy.** The ZIP contains a password hash, live auth tokens, IP
  history and device identifiers. Accepting it would make us controller of
  a pile of sensitive data we have no use for, against AGENTS.md rule 5
  and docs/PRIVACY.md. Every other tool in this space parses client-side
  and says so prominently; it is also a *selling point*, not just a
  constraint.
- **CPU.** 10ms per request on the Workers free plan. Unzipping and
  parsing several MB of CSV is not happening server-side at any plan we
  would want to pay for.
- **Password.** The ZIP is encrypted and the user has the password. Doing
  it in their browser means we never handle it.

So: a client component on `/app/import` that takes the file and the
password, unzips it (zip.js handles ZipCrypto *and* AES; the refract
converter vendors `zip-full.min.js` as precedent), reads **only** the
whitelisted filenames, and POSTs a small normalised JSON payload:

```ts
{
  source: "tvtime-gdpr-csv",           // or "tvtime-liberator-json"
  shows:   [{ tvdb: 121361, name: "Game of Thrones",
              followed: true, archived: false, rating: 9 | null }],
  watches: [{ tvdb: 121361, season: 1, episode: 1,
              watched_at: "2019-01-01T10:00:00Z" }],
  movies:  [{ name: "Inception", year: 2010, runtime_min: 148,
              watched_at: "...", watchlisted: false }],
  reported: { "121361": 73 }           // nb_episodes_seen, for validation
}
```
A 20k-episode history is a few hundred KB of JSON — fine. Check the client
bundle cost of the zip/CSV libraries against the 3 MiB gzip ceiling; client
chunks ship as OpenNext static assets rather than in the worker bundle, but
**measure with `npx wrangler deploy --dry-run` rather than assuming**, and
load the whole importer through `next/dynamic` so no other route pays.

### 2. Shows and episodes: an exact join, no matching

Per distinct TVDB series id in the payload:

1. `resolve_entities(p_provider => 'tvdb', p_entities => [...])` — the RPC
   already used by search — maps `provider_id` → internal id, creating stub
   rows as needed. One call for the whole batch, which matters because a
   per-show call would blow the subrequest budget.
2. `ensureSeriesIngested(internalId)` fills in seasons and episodes.
3. `episodes` is uniquely keyed **`(series_id, season_number, number)`** —
   precisely the triple the export gives us. Join, and insert `watches`.

`watches` is unique on `(user_id, entity_type, entity_id)`, so the whole
import is **idempotent**: re-running it cannot double-count, and a user who
imports twice gets the same library.

Follows come from `is_followed` on the `user-series-` rows unioned with
`followed_tv_show.csv`. Suggested rule, matching what TV Time meant:
followed **and not archived** → follow; archived but with watch history →
import the history, don't follow. Do not follow 300 shows someone finished
in 2014 — it would wreck the up-next feed, which is the app's whole point.

### 3. Movies: the part that needs a human

No ids. `movie_name` + year is all there is. Recommended rule:

- TVDB search by name; accept automatically **only** on a single result
  whose normalised title matches exactly and whose year is within ±1.
- Everything else goes to a staging table and a resolution UI: one row per
  unresolved film, three candidate posters, click to pick or skip.
- Never auto-accept a fuzzy match. A wrong film in someone's history is
  worse than a missing one, and unlike episodes there is no counter to
  validate against.

Most TV Time libraries are overwhelmingly episodes, so the manual tail is
bounded — prior implementations report "typically a handful".

### 4. The real blocker: ingestion cost

This, not parsing, is what makes the feature hard.

A typical account follows 100–400 shows. `ensureSeriesIngested` on a large
show is ~30 subrequests. The **free plan allows 50 external subrequests per
invocation and 10ms CPU**, which is why `/api/refresh` runs `BATCH = 2` on
an hourly cron. At that rate a 200-show import takes **100 hours**. That is
not a product.

Two things follow.

**(a) Recommend moving to Workers Paid.** $5/mo buys 30s CPU (raisable to
5 min via `limits.cpu_ms`) and 10,000 subrequests per invocation — the
subrequest cap was raised from 1,000 in Feb 2026. It also lifts the bundle
ceiling to 10 MiB. We are charging for the product and about to spend
effort on customer acquisition; the hosting plan should not be the thing
that caps it. Several already-known gaps (ingestion in the request path,
big-show render cost) trace back to the same ceiling. **Owner's call**,
but I'd make it before building this rather than after.

**(b) Build it as a job regardless of plan.** Even with 5 minutes of CPU,
a synchronous import is fragile: TVDB rate limits, transient failures, and
a user closing the tab. Design:

- `import_jobs(id, user_id, source, status, created_at, finished_at,
  counts jsonb)` — one row per run.
- `import_watch_intents(job_id, user_id, tvdb_series_id, season_number,
  episode_number, watched_at, resolved_watch_id null)` — the parsed
  payload, stored verbatim before any provider call.
- **Phase 1 (instant, pure DB):** write the job, the intents, the follows
  and the show ratings. No network. The user immediately sees "4,213
  episodes across 187 shows queued".
- **Phase 2 (background):** a batched worker walks the job's distinct
  series ids, calls `ensureSeriesIngested`, then materialises every intent
  for that series into `watches`. Order **followed shows first** so the
  feed — the daily driver — becomes useful within minutes rather than
  hours. Reuse the cron entrypoint pattern from ADR-0010; a dedicated
  `/api/import/run` guarded the same way as `/api/refresh` is the obvious
  shape, invoked more often than hourly while a job is open.
- Intents are the safety net: an episode TheTVDB has since renumbered
  simply stays unresolved and is **reported**, instead of vanishing. Note
  they roughly double the per-user row count while retained — immaterial in
  storage terms (a `watches` row is ~200 B including its three index
  entries), but don't quote per-user costs without counting them.
- Any abuse bound on free imports (a row cap, one job at a time) has to
  stay compatible with **re-running** an import: the design is idempotent
  on purpose, and "one import per account, ever" would break the fix-it-and-
  retry path that makes that idempotency worth having.

Show the progress. A progress bar on `/app/import` reading job counts is
worth more than shaving minutes off the run.

### 5. Rewatches

The export carries `rewatch_count` and `rewatch-episode-` rows; our
`watches` table is unique per (user, entity) because rewatch tracking is
deliberately deferred (DATA-MODEL.md). Collapse duplicates to the
**earliest** watch — that is when the person actually first saw it, which
is what the era/activity analytics in Phase 2 are asking about. Preserve
`rewatch_count` in the intents row so the icebox "relax `watches`
uniqueness" item can backfill real rewatch history later without a second
import.

### 6. Validate loudly, never lose silently

`user_tv_show_data.csv` gives TV Time's own `nb_episodes_seen` per show.
After phase 2, compare per show and show the user a reconciliation:
imported vs. reported, worst shortfalls first. Every prior implementation
found gaps — deleted shows, specials counted differently, TheTVDB
renumbering between 2016 and now. Surfacing a 3% shortfall builds more
trust than a silent 100% claim, and it is the difference between a Reddit
comment saying "it worked" and one saying "it dropped half my history".

Also report: rows skipped and why, unresolved intents, unmatched films.

### 7. Ratings — import shows, skip the emoji

- **Do** import `tv_show_rate.csv` → `ratings(entity_type='series')`.
  Confirm the scale against a real export before shipping; TV Time's show
  rating is believed to be out of 10, which maps 1:1 onto ours, but I have
  not seen a real row and a silent 2× error in everyone's ratings is not
  recoverable.
- **Don't** map the episode/movie reaction files. They are a three-value
  emoji scale, and inventing "Wow = 10, Good = 7, Meh = 4" would inject
  fabricated precision into the very column DATA-MODEL.md says feeds
  future recommendations. If we want them, they belong in their own
  table, later.

### 8. Honest caveat on dates

`created_at` is when the check-in was *recorded*, not necessarily when the
episode was watched — anyone who bulk-marked a season in TV Time has a few
hundred episodes stamped to the same minute. Nothing to fix; worth one
sentence in the import summary so the activity timeline in Phase 2 does not
look broken.

### 9. Paywall interaction — **decided 2026-08-19**

ADR-0014 makes free accounts read-only, and import is a write, so as things
stand an importer reached from a Reddit post walks into `/app/plans`.

**Decision: (a) below — preview free, commit behind the plan.** Recorded in
ADR-0015 and VISION.md; ADR-0014 is untouched, because import is simply a
write like any other. The alternatives are kept here so the reasoning
survives rather than having to be rediscovered.

**(a) Preview free, commit behind the plan — chosen.** Parsing is client-side and
costs nothing, so an unpaid visitor drops in their ZIP and sees "187 shows,
4,213 episodes, 62 films, back to 2013" *before* any ask. Crucially, **the
annual plan carries a 1-month free trial** — so for the plan we steer people
to, "pay to import" is really "start a trial and your import runs now": the
full rescue, today, for nothing. It converts the cohort's one emotional
moment instead of spending it, and keeps every importer inside a support
relationship that has revenue attached.

**(b) Import free and permanent, writes paid — rejected.** The most
generous framing and the best Reddit optics, and the *financial* risk really
is near zero: TVDB calls cost nothing under $50k/yr revenue, and a `watches`
row is ~200 B including its three index entries, so a thousand free
importers is well inside Supabase Pro's included storage. It was rejected on
funnel grounds, not cost — see the two traps below. Note ADR-0014 had
already considered and rejected a free-forever tier for the same reason,
and the annual plan's 1-month trial is what makes (a) humane rather than
extractive.

**(c) Paywall the whole thing — rejected.** Defensible, worst optics, no
reason to choose it over (a).

Also considered and dropped: giving paying users **queue priority** for
metadata ingestion. Under (a) everyone importing is already a payer, so
there is nothing to prioritise; under (b) it would mean deliberately slow
free imports, which is self-sabotage for a launch whose entire pitch is
import quality. The honest day-one reason to pay is writes.

Two things weigh against (b) that are easy to miss:

- **It gives away the one moment this cohort converts on.** For someone
  whose motivation is "my dead service's data needs a home", (b) satisfies
  the job *completely* — import, view, and (per ADR-0014's promise) export.
  There is no second conversion moment: a read-only archive has no return
  trigger, and VISION.md's "calm — no engagement bait" rules out nagging
  them back.
- **Combined with data export, it is a free conversion service.** We are
  the only tracker that can join a TV Time export exactly. Import + export
  on a free tier means someone can launder their ZIP through us and carry
  clean, TVDB-keyed output to Trakt. That is a genuinely useful public
  service and a defensible thing to offer on purpose — but it should be a
  decision, not a side effect.

Whichever way this goes, **do not** ship (b) and then degrade or expire it
later. A promised permanent archive that is later withdrawn inverts the
goodwill violently.

## Prerequisites that gate a public launch — regardless of §9

These are not import work, but a Reddit launch makes public promises that
the app cannot currently keep. Fix before inviting a wave, not after.

1. **Data export does not exist** (ROADMAP Phase 2, unchecked). "Your data
   is yours, always exportable" is load-bearing in VISION.md's product
   principles and in any honest launch post — and r/DataHoarder and
   r/selfhosted are precisely the audiences that will test it on day one.
2. **Self-serve account deletion does not exist** (ROADMAP Phase 3,
   unchecked; the privacy page currently promises email handling). A wave
   of EU accounts holding years of personal watch history, deletable only
   by hand, is real GDPR operational exposure on a solo operation. This is
   the actual legal risk here — not the import.
3. **`TvdbClient` has no 429 backoff.** It retries once on an expired
   token and nothing else. A bulk import against a shared API key without
   backoff is how the key gets throttled for *everyone*, paying users
   included — and ingestion still runs in the request path, so their page
   loads are what degrades.
4. **Imported follows permanently enlarge the refresh working set.** Every
   followed series from every import is refreshed hourly forever by the
   ADR-0010 cron. The recurring cost of an import is not the one-time
   ingest — it is this. It is a further reason to follow only what TV Time
   had *actively* followed (§2) rather than everything with history, and
   worth measuring before a wave rather than after.


## Work items

1. **Decide the two owner's calls** (§4a Workers Paid, §9 paywall
   placement). Both change what gets built.
2. **Fixtures** — synthetic CSVs in-repo per Samples (3), plus a Liberator
   JSON fixture. Unit-test the parser against them.
3. **Parser package** — pure, DOM-free, no network:
   `packages/tvtime-import` (or `apps/web/src/lib/import/`) taking a map of
   `{ filename: rows }` and returning the normalised payload. Keep it pure
   so it tests in Node and runs in the browser, the way the refract
   converter does. Source-priority handling and a "no recognised files"
   error live here.
4. **Client route** `/app/import` — file + password input, zip.js, the
   whitelist, the free preview, dynamic import. Nothing sensitive leaves
   the browser; say so on the page.
5. **Migration** — `import_jobs`, `import_watch_intents`. RLS scoped to
   the owner, **and explicit grants** including `service_role` (AGENTS.md
   "Database gotchas"). Regenerate `@stubs/db` types.
6. **Phase-1 action** — validate and persist the payload; follows and show
   ratings applied immediately. Behind `requireWriteAccess()`.
7. **Phase-2 worker** — `/api/import/run`, `CRON_SECRET`-guarded like
   `/api/refresh`, batched, followed-shows-first, resumable, idempotent.
8. **Movie resolution UI** — staged candidates, click to confirm or skip.
9. **Reconciliation report** — per-show imported vs. `nb_episodes_seen`,
   unresolved intents, skipped rows.
10. **ADR** if the Workers Paid move happens (it supersedes assumptions in
    ADR-0002 and a good deal of AGENTS.md), and a docs/ROADMAP.md entry
    either way.

## What this does not do

Comments, reactions, badges, addiction scores, friends, and social
activity are in the export and are not going anywhere in this app. Lists
and favourites are recoverable from `lists-prod-lists.csv` but need a
lists feature first. Note in the import summary that these were not
imported, so nobody assumes we silently dropped them.
