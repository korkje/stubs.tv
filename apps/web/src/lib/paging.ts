/**
 * Page sizes for every lazily loaded list — the feed, the library tabs,
 * and the search results all pace the same way, so the surfaces cannot
 * drift apart in feel. Lives outside the action files because a
 * "use server" file may only export async functions.
 *
 * The seed page renders on the server, so it is also bounded by the
 * Workers free plan's 10ms CPU ceiling (ADR-0002): it must stay well under
 * the row count that returns HTTP 1102. Later pages render on the client
 * and are not bound by it.
 */

/** The server-rendered first page. */
export const PAGE_SEED = 20;

/** Each further load while scrolling. */
export const PAGE_STEP = 10;

/**
 * The feed opens in two directions at once, so its seed is PAGE_SEED split
 * across them — the first render still carries 20 rows in total, the same
 * budget as every other list.
 */
export const FEED_SEED = PAGE_SEED / 2;
