# Plan: tokenized iCal feed

Status: **not started**. Written up so it can be picked up cold — by a
future session, a cloud agent, or a future self. Prerequisite (hourly
metadata refresh, ADR-0010) is **done**: a subscribed calendar showing
stale air dates would be worse than no calendar, which is why that came
first.

## What it is

An `.ics` URL the user pastes into Google Calendar, Apple Calendar or
Outlook once, after which **the calendar app polls it on its own schedule**
— Apple every few hours, Google up to about a day. There is no push, no
OAuth and no SDK: iCalendar (RFC 5545) is a text format, and we serve it
freshly generated per request.

`webcal://` is only a URL-scheme convention that makes a click open the
calendar app instead of the browser; the request itself is plain HTTPS.

## The one interesting design problem: auth

Calendar clients cannot sign in — no cookies, no bearer token, no
redirects. **The URL is the credential**, exactly as Google Calendar's own
"secret address" works. Consequences:

- A per-user random token in the path:
  `https://stubs.tv/api/calendar/<token>.ics`.
- The route must **not** use the RLS-scoped server client (there is no
  session). Use `createServiceClient()`, look the token up in `profiles`,
  and filter every subsequent query by that `user_id` explicitly. This is
  the only place outside ingestion that uses the service role, so it
  deserves a comment saying why.
- The token must be regenerable (leak → new URL, old one dies).
- Do not log the full URL anywhere it would be retained.

## Work items

1. **Migration** — `alter table public.profiles add column calendar_token
   uuid not null default gen_random_uuid()` plus a unique index (lookups
   are by token). Backfills existing rows automatically. Add a
   `regenerate_calendar_token()` security-definer function following the
   house pattern (`set search_path = ''`, revoke from public, grant to
   authenticated) — or do it as a plain owner-scoped update, since RLS
   already restricts profiles to the owner; the column grant in
   `20260812120000_user_settings.sql` would need extending either way.
   Regenerate the DB types afterwards (`npm run db:types`).

2. **Route** — `apps/web/src/app/api/calendar/[token]/route.ts` (or
   `[token].ics`; decide how the extension is handled — some clients care
   about the path suffix, and `.ics` in the path is friendlier to paste).
   Returns `text/calendar; charset=utf-8`. **Critical:** the auth proxy in
   `lib/supabase/proxy.ts` guards `/app` and `/admin` only, so `/api/...`
   is already public — do not "fix" that by widening the matcher.

3. **Query** — essentially the future half of `up_next()`, but for a
   *given* user id rather than `auth.uid()`. Options: a second SQL function
   taking a user id (service-role only), or plain PostgREST queries in the
   route. Prefer the SQL function: `up_next` already encodes the "followed,
   unwatched, aired-dated, specials-respecting" rules and duplicating them
   in TypeScript invites drift.

4. **ICS generation** — small hand-rolled serializer, no dependency
   (the format is trivial and the bundle budget is real):
   - `BEGIN:VCALENDAR` / `VERSION:2.0` / `PRODID:-//stubs.tv//EN`,
     `X-WR-CALNAME:stubs.tv`, and a refresh hint
     (`REFRESH-INTERVAL;VALUE=DURATION:PT12H` + `X-PUBLISHED-TTL:PT12H`).
   - One `VEVENT` per upcoming episode, as an **all-day** event:
     `DTSTART;VALUE=DATE:YYYYMMDD` and `DTEND` the following day.
   - `UID` must be stable across polls or clients duplicate events —
     e.g. `episode-<episode_id>@stubs.tv`.
   - `SUMMARY:Smallville 10×20 — Prophecy`, `URL` back to
     `https://stubs.tv/app/series/<id>`.
   - **Escaping**: `\\`, `;`, `,` and newlines in any text value, per RFC
     5545. Line-fold at 75 octets. CRLF line endings, including the last.
   - `DTSTAMP` per event (some clients reject events without it).

5. **Settings UI** — a Calendar section on `/app/settings` showing the URL
   with a copy button (reuse `CopyInviteLink`'s pattern), a short
   explanation of "subscribe, don't import", and a Regenerate button with a
   confirmation, since it breaks existing subscriptions.

## Decisions to make (not yet settled)

- **Window**: upcoming only, or also recent unwatched episodes? Calendars
  are about the future; a backlog dumped into last month's dates is noise.
  Suggested: future only, capped at ~12 months.
- **Synopses in `DESCRIPTION`**: should respect `synopsis_mode` — a
  spoiler-averse user would not want them pushed into their calendar.
  Scrambling them there is absurd, so treat `scramble` as "omit".
- **Per-show calendars** — a separate token per followed show is a common
  request but a much bigger surface. Not now.

## Verification notes

- `curl` the URL and validate the output — an online iCal validator, or
  simply subscribing from Apple Calendar (fastest real check; it polls
  soon after adding).
- Confirm a *wrong* token returns 404 and never leaks whether it existed.
- Confirm the response is not cached in a way that outlives the data:
  `Cache-Control: private, max-age=0, must-revalidate` is a sane start.
