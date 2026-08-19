# ADR-0015: Third-party imports are parsed in the browser; the archive never reaches the server

- Status: accepted
- Date: 2026-08-19

## Context

TV Time shut down on 2026-07-15 and deleted its users' data, leaving a lot
of people holding a GDPR export ZIP with no home for it. Because TV Time
and TheTVDB were both Whip Media properties, that export is keyed by
TheTVDB ids — and this app is TheTVDB-native (ADR-0004) — so shows and
episodes import as an exact join rather than a fuzzy match. Worth
building; planned in detail in [docs/plans/tvtime-import.md](../plans/tvtime-import.md).

The obvious shape — upload the ZIP, parse it server-side — is wrong here
for three independent reasons, any one of which is decisive:

1. **The archive contains credentials.** Alongside watch history, a TV Time
   GDPR ZIP carries the user's password hash, live access and refresh
   tokens, IP history, device identifiers and social-account data.
   Receiving it would make us controller of a pile of sensitive data we
   have no use for, against the privacy-by-design rule in AGENTS.md and
   docs/PRIVACY.md.
2. **The CPU budget forbids it.** Unzipping and parsing megabytes of CSV
   does not fit in 10ms (ADR-0002), and would not be a good use of the
   paid tier's 30s either.
3. **The archive is encrypted and the user holds the password**, which
   TV Time mailed separately. Parsing in the browser means we never handle
   it.

Future importers (Trakt, IMDb, Letterboxd, plain CSV — ROADMAP icebox)
have the same shape, so this is a standing rule rather than a one-off.

## Decision

1. **Parsing happens in the browser.** A client component reads the file,
   decrypts and unzips it locally, and reads **only** an explicit
   allow-list of watch-history filenames. Files carrying credentials,
   identity, devices or IP history are never opened, and the parser fails
   closed on anything unrecognised rather than importing silently.
2. **Only a normalised payload is sent** — TheTVDB series ids, season and
   episode numbers, timestamps, film titles with years, show ratings.
   A large history is a few hundred KB of JSON.
3. **The parser is pure and provider-agnostic** — no DOM, no network, no
   Supabase — so it unit-tests in Node against fixtures and runs unchanged
   in the browser. Format-specific readers normalise into one internal
   shape; the commit path never learns which service the data came from.
4. **Import is a write, so it needs a plan.** ADR-0014 stands unchanged:
   `requireWriteAccess()` gates the commit like every other mutation. What
   is free is the **preview** — because parsing is client-side, a
   logged-out visitor can drop in their ZIP and see what it contains
   ("187 shows, 4,213 episodes, back to 2013") before being asked for
   anything. The annual plan's 1-month trial then means the import itself
   costs nothing at the point of use.
5. **The heavy half is a background job, not a request.** Metadata
   ingestion for hundreds of shows cannot happen in one invocation at any
   CPU limit we would pay for. The payload is persisted first as watch
   *intents* (pure DB, no network), then materialised into `watches` as
   each series is ingested — see the plan doc.

## Consequences

- We never possess anyone's TV Time credentials, and can say so plainly on
  the import page. For an audience that just watched a service delete their
  data, that is a feature, not fine print.
- The preview doubles as marketing: a public `/import/tv-time` page can
  demo the real thing to a stranger with no account and no server cost,
  which outlives the launch post that search traffic arrives after.
- A zip/CSV library ships in the client bundle. Client chunks are OpenNext
  static assets rather than worker code, but the 3 MiB gzip ceiling
  (ADR-0002) still needs measuring with `wrangler deploy --dry-run`, and
  the importer must load through `next/dynamic` so no other route pays for
  it.
- Browser-side parsing means we cannot fix a malformed export for the user
  or reproduce their failure from a server log. The parser has to report
  precisely what it found, what it skipped and why — and the import has to
  reconcile against TV Time's own per-show seen counts so a shortfall is
  visible rather than silent.
- Anyone who self-hosts gets the importer with no additional service, since
  there is no server-side parsing component to run.
