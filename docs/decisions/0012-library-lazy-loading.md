# ADR-0012: Library lists lazy-load through client-held pages

- Status: accepted
- Date: 2026-08-17

## Context

Both library lists fetched and rendered the entire library on every request
(`select("*")` with no range). On the Workers free plan's 10ms CPU budget
(ADR-0002), a page rendering hundreds of rows returns HTTP 1102 in
production, so an unbounded library list was a scaling failure waiting to
happen, not just wasted bandwidth.

The up-next feed had already solved this shape: server-rendered seed page,
a client component accumulating keyset pages fetched through a server
action, a bottom sentinel auto-loading ahead of the scroll. The library
needs only the downward (append) half — none of the feed's prepend/scroll-
compensation machinery applies.

## Decision

- `fetchLibraryShows` / `fetchLibraryMovies` (`lib/library/actions.ts`)
  return one page of view rows, re-validating filter, sort, offset, and
  limit inputs server-side. The server components call them for the seed
  page; the client lists call them as server actions for the rest.
- **One paging rhythm for every lazy list** (`lib/paging.ts`): the server
  renders `PAGE_SEED = 20` rows, each further load brings `PAGE_STEP = 10`.
  The feed opens in two directions at once, so its seed is the same budget
  split in half (`FEED_SEED = 10` per direction, 20 rows total) and its
  "Show older" button steps by 10. Search is deliberately NOT paged: the
  provider returns one bounded, popularity-ranked set (paging it would
  re-rank per page), and lazily revealing rows that are already fetched
  would be pacing theatre.
- **Offset pagination, not keyset.** The sort key is user-chosen and mostly
  nullable, so a correct keyset cursor is a different shape per key; a
  personal library is thousands of rows at most, where offset cost is
  noise. The implicit name tiebreaker keeps the order stable across pages.
  Accepted trade-off: a concurrent insert/remove can shift a page boundary
  by one — the overlap direction is deduped client-side, the gap direction
  heals on the next visit.
- **Rows live in client state, so the surface never revalidates itself**
  (the feed's existing rule, now shared): a `revalidatePath` of the viewed
  route re-renders the seed page under pages the server no longer knows
  about. The library's toggles work on the client rows — FollowStar and
  SeenEye grew a controlled mode where the parent owns the state and the
  server call — and membership removals (unfollow with no watches, unmark
  seen) collapse the row locally after the action lands. `revalidate`
  became optional on the tracking actions; dynamic routes have
  `staleTimes.dynamic = 0`, so other surfaces are fresh on next navigation
  regardless.
- A filters/sort change resets the accumulated pages without remounting the
  list (adjust-during-render on a serialized seed key), keeping the
  AnimatedRows diff animation across filter changes. Paged-in rows carry
  `entrance: false` and appear in place — they arrive below the fold, and
  fifty rows expanding into place is churn, not choreography.

- **Tab counts stay live through a client context** (`LibraryCounts`), not
  through revalidation: the counts are exactly membership (series_progress
  rows, movies marked seen), and the lists know the moment membership
  changes — the toggles adjust the context by ±1 when the server confirms
  an action. Fresh server counts win on every navigation; the deltas only
  bridge the gap between two server renders.

## Consequences

- Per-request rendering is bounded at one seed page regardless of library
  size, and later pages render on the client.
- Toggle semantics on the library rows changed from optimistic-against-
  server-prop to click-is-truth with an error snap-back, matching the feed.
- Count adjustments key off the confirmed action, not off row removal, so
  rapid toggle sequences net correctly; a change made on another device
  mid-session is invisible until the next navigation, when the server
  numbers replace the adjusted ones.
