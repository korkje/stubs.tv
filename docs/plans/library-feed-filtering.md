# Plan: filtering the library and the feed

Status: **built**, 2026-08-14, then reworked the same day after an owner
review of the first pass. Kept as the record of why it is shaped the way it
is; the traps in the work items are the part worth re-reading before
touching this code. What the rework settled:

- The library's resting state is **one row**: search field and two icon
  buttons (filters, sort), all the same height. Filters open an **inline
  panel** — the list stays visible underneath while it is narrowed, which a
  popover would cover; sort, being two compact rows, is a **popover** on
  its button. Both buttons wear their active state (colour, and a count
  riding on top of the filters button) while shut, because a narrowed list
  that looks complete is the trap. Chips appear only while the filter panel
  is shut.
- The panels are **labelled fields**, not a strip of controls. Every facet
  says what it is ("Status", "Progress", "My rating"), and what no selection
  means is written down ("All") instead of being implied by unlit buttons.
- **Following and Progress are tri-states** (All / Following / Not
  following, All / Behind / Caught up) — "not followed" and "caught up" are
  real questions, and a plain toggle can only ask one direction. **Status
  is the same control** (All / Ongoing / Ended / Upcoming), single-select:
  it keeps every choice facet the same shape, and no real question needs
  two of the three statuses at once. All of these fill their parent's width
  and may compress below their widest label (min-width: 0 — the
  min-content floor is what turns "stretch" into sideways overflow on
  narrow screens), dropping to the smaller control size below `xs`.
- **Rating is a two-thumb range** like episode length, not a minimum-only
  select. Any active rating bound matches only rated shows — "5 or less"
  does not sweep in the unrated.
- **Sliders navigate on release**, not per step; the value shown while
  dragging is local. The readout sits right-aligned on the field's label
  row, where changing width costs nothing — the earlier fixed-width-label
  trick reserved the space but wasted it visibly.
- **Sort is one row**: a field and Asc/Desc. Picking a field applies its
  natural direction (rating opens highest-first), and **ties always break
  on name A–Z implicitly** — a visible "then by" earned its space for one
  use case, which the implicit rule covers. `?sort=rating` therefore means
  "highest rated, alphabetical within ties" on its own.
- **Filter changes animate the list difference.** The rows wrapper is not
  keyed on the filters, so AnimatedRows keeps its instance across the
  navigation: dropped rows collapse away, survivors keep their place,
  returning rows expand back in — instead of the whole list re-entering.
  The empty state is a row of the same list, so narrowing to nothing is
  the same choreography. Two traps made this hard-won, recorded in
  AnimatedRows itself: rows must carry identity as an **explicit id prop,
  not a React key** (keys survive SSR but arrive stripped to positions in
  the RSC payload of a soft navigation, which made every surviving row
  exit over its own replacement), and a departed row's id must be
  **forgotten when it leaves** so its return animates instead of popping
  in at full height. Sort changes still remount deliberately — a reorder
  moves every row at once, which reads better as a fresh entrance. So does
  a single-choice facet switching between two non-null values (`remountOn`
  in AnimatedRows): "Ended" → "Ongoing" produces disjoint lists, and
  diffing those is all churn. The diff is reserved for changes touching
  "All", where one list contains the other.
- **The feed's prepend compensation must be the only compensation.** The
  browser's own scroll anchoring corrects an insertion above the viewport
  by itself, and the feed's manual `scrollBy` cannot see that it did — both
  corrections applied, and every past page hurled the viewport a full page
  back down. `overflow-anchor: none` on the feed container leaves exactly
  one mechanism (ours, since anchoring is not implemented everywhere), and
  the top spinner sits in a fixed-height slot so starting a load shifts
  nothing either. **Auto-loading the past died on WebKit — do not
  rebuild it without reading this.** Its main thread can neither observe
  nor adjust the compositor's scroll while a gesture runs, so every
  strategy for landing a prepend above a moving viewport failed on a
  real iPhone in turn: immediate compensation flickered (compositor
  paints from the stale layer tree) and died mid-gesture (iOS drops the
  scrollBy, leaving the sentinel in range to chain-fire a second page);
  waiting for a gap in scroll events false-quieted (iOS throttles them
  mid-glide); waiting for scrollY to hold still false-quieted too (iOS
  syncs scrollY to the main thread sparsely during momentum), and the
  anti-stall escape just made mid-scroll landings the common case.
  react-virtuoso is no exit: its window-scroll prepend has the same open
  defect (petyosi/react-virtuoso#1009), because the physics are the
  window scroller's, not ours. The resolution is a **"Show older
  episodes" button**: a tap is a standstill, where the compensation is
  exact on every engine — and the future keeps auto-loading, because
  appends never move content above them. (Also learned: Playwright's
  trunk WebKit reports scroll-anchoring support no shipping Safari has —
  don't trust capability checks validated only there.)
- **The feed's filters are gone**; following a show already is the feed's
  filter, so what remains is one setting — include watched episodes —
  behind the floating button, which stays **inside the content column** on
  wide screens rather than drifting to the viewport corner. The one switch
  still lives in a popover rather than being the button itself: the eye is
  the mark-seen verb everywhere else, and a floating eye over the feed
  reads as "mark all of this". `up_next` keeps its facet parameters, so
  widening `FEED_FACETS` back is a one-line change if a need appears.
- **The watched toggle remounts the feed** (it is keyed on the filters in
  app/page.tsx): a fresh scroll-to-Today and the middle-out entrance
  stagger. Morphing the rows in place — the library treatment — was built,
  made to work, and **deliberately reverted**, so re-read this before
  trying again: the rows themselves diff fine (feed rows are client state,
  no RSC key problem), but holding the viewport steady while heights
  animate above it required a Today-pin running inside motion's frame
  pipeline (a raw rAF races motion's writes and the page visibly shakes
  once enough rows animate at once), `overflow-anchor: none` against the
  browser's own compensation, a settle window against the router
  re-asserting its scroll position mid-commit, a generation counter
  against in-flight pages crossing a toggle, and cursors split from the
  visible rows. All of it worked; the owner's verdict was that it felt
  like a trick — the anchor question ("hold what, exactly, while the
  content defining it disappears?") has no answer that feels natural. The
  honest behaviour is a fresh entrance at Today.
- The library's pending spinner lives **in the search field's magnifier
  slot** (Spinner keeps its children's box), so the row needs no reserved
  cell for it.

## What it is

Narrow the library and the feed by what the titles *are* and by where the
user *is* in them, and sort the library by more than one key. The bar to
clear is set by the owner's own example, which should be expressible without
thinking:

> shows with episodes under 40 minutes, that have ended, that I follow, and
> that I have rated 7 or better — sorted by rating descending, then name

and

> only shows I am not up to date on

Both are conjunctions of simple predicates over heterogeneous fields. That
is the shape to design for. Not a query language, not boolean algebra: a
handful of well-chosen facets that combine with AND, where every combination
is instant and shareable.

## Two surfaces, one vocabulary, one asymmetry

The filters must mean the same thing in both places, so they are defined
once — a single TypeScript module owning the filter type, its URL encoding
and its validation — and each surface declares which facets it offers. A
filter is a property of a *series*; the feed's rows are episodes, so the
feed applies series-level predicates through each episode's series.

**Sorting is library-only, and this is not an aesthetic call.** The feed is
a bidirectional keyset walk outward from Today: `(aired, episode_id)` is
both its sort order and its pagination cursor. An arbitrary sort would not
merely change the feed's character, it would break paging outright. The feed
takes filters; it does not take a sort.

## What the data supports today, and what it does not

Verified against a local database with real ingested rows:

| Facet | Where | Source | State |
|---|---|---|---|
| Search by name | library | `series_progress.name` | ready |
| Following | library | `series_progress.followed` | ready |
| My rating | both | `series_progress.rating` | ready |
| Episode length | both | `series.runtime_min` | ready |
| Up to date | library | `aired_episodes` vs `watched_episodes` | needs a column — see below |
| Status | both | `series.status` | **not in the view** |
| Include watched | feed | `up_next`'s watched join | RPC change — see work item 4 |

Three findings that shape the work:

1. **`series_progress` does not expose `status`.** The view has to gain it.
   It is a plain column on `series`, which the view already joins, so this
   is additive. (`genres` is the same one-line change if genre filtering is
   ever wanted — it is out of v1.)

2. **The status facet has exactly three options.** `status` stores
   TheTVDB's own name verbatim (`map.ts` → `text(raw.status?.name)`), and the
   values that land are `Continuing`, `Ended` and `Upcoming` — a closed set,
   which is what makes this a good facet. Note that `Ended` covers both a
   show that concluded and one that was cancelled; TheTVDB does not
   distinguish them, so neither can we.

   The labels shown are **Ongoing · Ended · Upcoming**. `Continuing` is
   provider jargon; "Ongoing" is what a viewer would say. "Airing" was the
   other candidate and is worse: a show between seasons is `Continuing` but
   is not airing, so the label would read as false half the year. Store the
   provider values, translate at the edge — the label mapping lives with the
   facet definition, never in the database.

3. **`runtime_min` is TheTVDB's `averageRuntime`** — the average length of an
   episode, not the length of the show. So "episodes under 40 minutes" is a
   direct read, not a proxy. Per-episode runtime exists on `episodes` but
   aggregating it is unnecessary for v1.

### The one non-obvious constraint

**PostgREST cannot compare two columns to each other.** `aired_episodes >
watched_episodes` is not expressible as a `.select()` filter, so "not up to
date" cannot be built from the two counts the view already returns. Either
the library query becomes an RPC — losing the plain, readable PostgREST
chain — or the view computes the comparison itself.

Compute it in the view: add `unwatched_episodes` (`greatest(aired -
watched, 0)`, matching the arithmetic `ShowsList` does in TypeScript today)
and filter on `.gt("unwatched_episodes", 0)`. It also lets `ShowsList` drop
its own subtraction, so the count in the badge and the count the filter
judges cannot drift apart.

## URL as the single source of truth

Filter and sort state lives entirely in `searchParams`. No client state, no
context, no local storage. This is worth stating as a decision because
several good things fall out of it for free:

- Every filtered view is a link — shareable, bookmarkable, back-button
  correct.
- The pages stay server components. Filtering happens in SQL, which the 10ms
  CPU ceiling (ADR-0002) requires anyway: filtering a list in the worker
  after fetching it is exactly the shape that returns HTTP 1102 in
  production.
- `staleTimes.dynamic: 30` keys the router cache by URL, so each filter
  combination caches independently. Flipping between two filter sets is
  instant and free.
- **Saved views become trivial later**: a saved view is a named URL. That is
  an argument for URL state now, and for leaving saved views out of v1.

## Interface

The two surfaces differ in how much the filter should assert itself:

- **Library** — a search field and the filter controls in a toolbar
  **below the tab bar**, always visible. Placing it under the tabs rather
  than above them is what makes the facet set a property of the *active
  tab*: Shows and Movies do not have the same fields, so they should not
  offer the same controls. Consequence for the tab links — they carry the
  filters that both tabs share and drop the ones that do not apply, rather
  than carrying everything and silently filtering on a field the other tab
  has no notion of.
- **Feed** — a floating round button, bottom right, opening the same
  controls in a sheet. The feed's job is "what do I watch next", and a
  permanent filter bar would compete with that. The button must show that
  filters are active (a dot or a count badge): a filtered feed that looks
  like an unfiltered one is a trap.

Radix Themes has Popover, Select, Checkbox, Slider and SegmentedControl but
no chip component — an active filter renders as a `Badge` with a close
`IconButton` inside it. Keep every control operable with a thumb: the feed's
sheet and the library toolbar collapse to the same stacked layout on narrow
screens.

**Search** is a plain name match, `.ilike("name", "%q%")` against the view,
debounced into the same URL state as everything else (`?q=`). It composes
with the filters rather than replacing them — searching within "ended shows
I rated 8+" is the whole point of putting them side by side. A leading
wildcard cannot use a B-tree index, which is irrelevant at a personal
library's scale; if it ever stops being irrelevant, the answer is a trigram
index, not a redesign. Note this is a *different* search from `/app/search`,
which queries TheTVDB: this one never leaves the user's own rows.

**Episode length is a two-thumb range**, not buckets — Radix Themes' Slider
takes an array value and renders a thumb per entry, so `[20, 60]` gives the
range directly. It is more powerful than presets and no harder to use, and
it handles "between 20 and 40" which buckets cannot express at all. Two
details decide whether it feels good: the ends must be releasable to
"unbounded" rather than clamping at hard limits (a show at 90 minutes must
not vanish because the track stops at 60), and the current range needs a
live numeric readout beside it, since a slider with no numbers is a guess.

The sort control is separate from the filters and library-only. It needs to
express an ordered list of keys ("rating descending, then name"), not a
single choice — two Select rows (primary, then tiebreaker) covers the
owner's example without building a drag-and-drop list.

### Sorting trap to get right the first time

`rating` is null for unrated shows, and Postgres sorts `DESC` with NULLS
FIRST. A naive "rating descending" therefore puts every *unrated* show
above the 10s. Pass `nullsFirst: false` explicitly on every nullable sort
key — `rating`, `first_aired`, `runtime_min`.

## Work items

1. **Migration — extend `series_progress`.** Add `status` and
   `unwatched_episodes`. Follow the house pattern the view's five previous
   revisions all use (most recently `20260812120000_user_settings.sql`):
   `drop view if exists`, then the full definition again, then re-grant.
   Two things must be carried over verbatim or the view breaks quietly:

   - `with (security_invoker = true)`. Without it the view runs as its
     owner, RLS on the underlying tables stops applying to the caller, and
     `series_progress` starts returning **every user's** rows. It is the
     single most important token in the file.
   - `grant select on public.series_progress to authenticated`. The drop
     takes the grant with it, and this project grants nothing by default,
     so the view would return nothing at all.

   Regenerate `@stubs/db` types (`npm run db:types`) and commit them.

2. **Filter vocabulary module** (`apps/web/src/lib/filters/`). One exported
   type, a parser from `searchParams`, a serializer back to a query string,
   and per-surface declarations of which facets apply. Validation lives here
   too: an unparseable or out-of-range param degrades to "no filter" rather
   than erroring, because these values arrive from the URL bar.

3. **Library page.** Read `searchParams`, chain the filters onto the
   existing `series_progress` query — `.ilike` for search, `.eq` for
   following, `.gte` for rating, `.gte`/`.lte` for the runtime range, `.in`
   for status, `.gt("unwatched_episodes", 0)` for behind — then `.order()`
   per sort key with `nullsFirst: false`. The tab links must carry the
   filters the target tab understands, or switching Shows/Movies silently
   drops them.

4. **Feed.** `up_next` gains filter parameters, and applies the same
   predicates against `series`, which it already joins; the keyset logic is
   untouched, since filters only narrow the candidate set. Thread the
   parameters through **three** call sites: the page's two seed fetches, and
   `fetchUpNext` from the client component — which means `UpNextFeed` takes
   the filter object as a prop and hands it back to the server action on
   every page load. Missing the third is the bug that will look like
   "filters stop applying when you scroll". Changing the RPC's signature
   means regenerating `@stubs/db` types again.

   **Key `UpNextFeed` on the serialized filter state.** It seeds `past` and
   `future` into `useState` from its props, which is read once at mount.
   Changing a filter re-renders the page on the server with fresh seed
   fetches, but the client instance persists — same type, same position, no
   key — so the new props are ignored and the old rows stay on screen. This
   is the same mechanism `FadeIn` documents ("client-side param changes on
   an already-mounted page keep the same instance") and the same fix the
   search page already uses (`<AnimatedRows key={query}>`). Without it the
   feed's filters look like they do nothing until a hard reload. Remounting
   also replays the scroll-to-Today, which is the wanted behaviour anyway.

   **No Following facet in the feed.** `up_next` inner joins `follows`, so
   the feed is followed-shows-only by construction; a Following switch there
   would visibly do nothing. Membership stays as it is.

   **Instead the feed gets "Include watched", off by default.** The RPC
   drops its `w.id is null` predicate when the flag is set, turning the feed
   from "what is left" into the full timeline of a followed show. Membership
   is untouched — this only changes which episodes within it are shown.

   ### The trap this sets, which must be fixed in the same change

   Two places currently hardcode the assumption that nothing in the feed has
   been watched, and both fail *silently and wrongly* the moment a watched
   episode can appear:

   - `UpNextRow.tsx:27` — `const [seen, setSeen] = useState(false)`. A
     watched episode would render with a closed eye, reading as unseen, and
     clicking it would try to mark as seen something already seen.
   - `UpNextRow.tsx:58` — *"Everything in this feed is unwatched, so the
     spoiler setting applies to every synopsis."* An episode the user has
     already watched would have its synopsis **scrambled as a spoiler**,
     which is both wrong and faintly insulting.

   So `up_next` must return a `watched` boolean per row, `UpNextRow` must
   seed its state from it instead of `false`, and the spoiler branch must key
   off it. Do not ship the flag without this; the feature looks fine in a
   screenshot and is broken in use.

5. **Toolbar and sheet.** A client component that builds the next query
   string and calls `router.replace`; the server re-renders. Active filters
   render as removable badges, with a "clear all" once more than one is set.
   `ShowsList`'s `<AnimatedRows key="shows">` has a milder version of the
   feed's remount problem: the key is constant, so `initialKeys` — captured
   at mount — goes stale and rows filtered back in play the "arriving later"
   entrance rather than the staggered one. Keying it on the filter
   serialization fixes it; the cost of not bothering is cosmetic.

6. **Empty states.** "No shows match these filters" is a different message
   from "your library is empty", and it needs a way back out.

## Deliberately not in v1

- **Live counts per option** ("Ended (12)"). This is the strongest cheap
  signal of *powerful yet easy*, and it is the obvious v2. Done properly it
  is one grouped RPC returning every facet's counts at once — not one query
  per option, which the CPU budget would not survive.
- **Saved and named views.** A URL already is one.
- **OR and NOT.** Every example the owner reached for is a conjunction.
  Adding boolean structure costs the simplicity that makes the thing feel
  easy; wait until a real need appears.
- **Genre.** Cut deliberately. It is the one facet with an unbounded option
  list, and an unbounded list is what makes a filter UI feel heavy — which
  is the opposite of the goal. Adding it later is one column in the view and
  one `.overlaps` call, so nothing here forecloses it.
- ~~**Filtering movies.**~~ Built after all, same day: the `movies_seen`
  view (ratings joined in SQL for the same PostgREST reason as
  series_progress), facets `query`/`rating`/`runtime` only — seen is the
  membership, so there is nothing else to ask — sort by name, my rating,
  released or length, and a **240-minute slider scale** where episodes get
  120. The toolbar took every surface-specific thing as props for this,
  and movies' two-slider facet set opens as a **popover** (`compact`)
  where the shows' five facets get the inline panel. Each tab restricts
  URL filters to its own facets and validates the sort against its own
  keys, so a shows link opened on the movies tab degrades clean.

## Settled

Decisions taken while writing this, recorded so they are not reopened:

- Status labels are **Ongoing · Ended · Upcoming** over the provider's
  `Continuing` / `Ended` / `Upcoming`.
- Episode length is a **two-thumb range slider** with a numeric readout and
  releasable ends, not preset buckets.
- **Genre is out.**
- The library gets a **search field beside the filters, below the tab bar**.
- The feed's membership rule **does not change**: followed shows only, so
  no Following facet there. Its one feed-specific facet is **Include
  watched, off by default**, which carries the `UpNextRow` fix in work
  item 4 with it.
