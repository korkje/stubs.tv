# ADR-0017: GDPR export and deletion are self-serve, in SQL and hard-deleted

- Status: accepted
- Date: 2026-08-20

## Context

PRIVACY.md has promised from day one that user data is exportable and
deletable, and the launch checklist ("to do before friends & family") had
both flows unticked. Until now the mechanism was "email privacy@stubs.tv",
which does not scale past friends and does not satisfy the product's own
"your data can't vanish" promise. With a public launch imminent, both
rights need to be self-serve from the settings page.

Three questions needed settling: where the export is assembled, what it
contains, and how deletion interacts with Polar (the merchant of record,
ADR-0013) and the auth user.

## Decision

**Export is one SQL function** (`export_user_data()`, security invoker) that
returns the caller's entire footprint as a single jsonb document; a route
handler at `/app/export` adds the auth-schema fields (email, created_at)
and serves it as a download. SQL rather than app code because it is one
round-trip, immune to PostgREST's 1000-row page cap (the bug that would
have shipped silently: a TV Time import easily exceeds it), and near-zero
worker CPU regardless of history size. Security invoker means RLS makes
"only your own rows" a property of the database, not of the handler.

The export carries **human-readable titles, never internal or provider
IDs**: series/season/episode numbers and names, movie titles and release
dates. Internal bigint IDs are meaningless outside this database, and
provider IDs stay confined to the ingestion layer (ADR-0004). Import-job
rows are included as summaries plus the data that exists nowhere else
(unmatched leftovers, rewatch counts); matched intents are already
represented by the exported watches. Export is deliberately not
plan-gated — read-only free accounts keep full export rights.

**Deletion is a hard delete of the auth user**, cascading through every
user table (`on delete cascade` from `auth.users` is already universal).
No soft delete, no retention window, no tombstone — PRIVACY.md's "no
soft-delete retention of personal data" taken literally. The action
requires the account password (a session alone is not proof of ownership;
same reasoning as the password-change flow) and runs the admin delete
through the service-role client — the third and last sanctioned
service-role site after ingestion and the Polar webhook.

**Polar is handled first, and the order must never be reversed.** Before
the auth user is touched, the action calls Polar's customer delete with
`anonymize: true`, which cancels any active subscription immediately and
hashes the PII Polar retains for tax/order records. If that call fails
while a subscription is live, deletion aborts — deleting the account first
would leave an ex-user being charged with no portal reachable through us.
Without a live subscription (lapsed, lifetime, Polar unconfigured — local
dev and the future self-hosted mode), a Polar failure logs and deletion
proceeds: erasure must not be blockable by an unreachable payment
provider. A 404 from Polar counts as success.

## Consequences

- New user tables MUST do two things or these flows silently rot: cascade
  from `auth.users`, and be added to `export_user_data()`. That is now part
  of adding any user table.
- The export doubles as the portability/backup feature VISION.md promises;
  a future import-from-export closes the loop.
- Deletion while an import job is running simply cascades the job and its
  intents away; the worker's next update matches zero rows and the job
  vanishes with the account. No coordination needed.
- Polar retains anonymized order records as merchant of record; the
  privacy page says so rather than pretending erasure reaches into tax law.
