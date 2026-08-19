# ADR-0018: The calendar feed authenticates by URL token

- Status: accepted
- Date: 2026-08-20

## Context

The tokenized iCal feed (docs/plans/ical-feed.md) lets a calendar app poll
upcoming episodes of followed shows. Calendar clients cannot sign in — no
cookies, no bearer tokens, no redirects — so the usual session-based auth
model cannot apply. The plan settled the mechanism; this ADR records it
and its consequences as decided, since "an unauthenticated route reading
user data through the service role" is exactly the kind of thing a later
security pass would flag without the written why.

## Decision

**The URL is the credential**, as in Google Calendar's own "secret
address": `/api/calendar/<uuid-token>.ics`, with the token stored on
`profiles.calendar_token` (unique, defaulted from `gen_random_uuid()`).

- **The route uses the service client** — there is no session to scope an
  RLS query by. Authorization is the token match inside
  `calendar_feed(p_token)` (security definer), which resolves the owner
  and returns only their rows: upcoming episodes (today to +12 months) of
  followed series, honouring the specials setting ('counted' includes
  season 0) and the synopsis setting ('show' includes overviews; scramble
  and hide omit them — a spoiler pushed into a calendar would defeat the
  setting). Unknown and malformed tokens are indistinguishable 404s;
  a known token with nothing upcoming is a valid empty calendar.
- **Tokens are regenerable, never user-chosen.**
  `regenerate_calendar_token()` (security definer, `auth.uid()`-scoped)
  mints a fresh `gen_random_uuid()`; a leaked URL dies the moment it runs.
  There is deliberately no column update grant — a user choosing their own
  token would make it guessable.
- **`calendar_token` stays OUT of `export_user_data()`** (ADR-0017 rule:
  new user data joins the export). It is a live credential, not personal
  data — exporting it would put a working secret URL into a JSON file
  people forward around. The export carries nothing the token unlocks that
  the export does not already contain.
- **Future-only rows.** The feed exposes follows and air dates, never
  watch history — what a leaked URL reveals is bounded by that.

## Consequences

- This is the fourth sanctioned service-role site (ingestion, Polar
  webhook, account deletion, calendar feed) — AGENTS.md and
  `lib/supabase/service.ts` list them.
- The route must stay outside the auth proxy's guard (it only matches
  `/app` and `/admin`); do not "fix" that.
- Cache headers are part of the security posture: `private, max-age=0,
  must-revalidate` — the URL is a credential, shared caches must not
  store the response.
- Rotating the token breaks every existing subscription; the settings UI
  says so before doing it. That is the feature, not a bug.
- The feed's "today" honours the profile timezone setting (null = UTC,
  the setting's documented semantics). This is about *inclusion*, not
  placement: events are all-day and cannot move, but subscriptions
  replace content wholesale on every poll — under a UTC-only boundary, a
  user west of UTC would watch tonight's episode vanish from their
  calendar the moment UTC rolls past midnight. A timezone value
  Postgres's tzdata does not recognise degrades to UTC instead of
  breaking the feed.
