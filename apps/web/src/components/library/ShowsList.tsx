import { fetchLibraryShows } from "@/lib/library/actions";
import { type Filters, type Sort } from "@/lib/filters";
import { PAGE_SEED } from "@/lib/paging";
import { ShowsListClient } from "./ShowsListClient";

/**
 * Every show the user follows or has watched episodes of, with how much is
 * left to watch. This server half only fetches the first page — rendering
 * a whole library in one request is exactly what the 10ms CPU ceiling
 * forbids — and the client half pages in the rest as the user scrolls.
 */
export async function ShowsList({
  filters,
  sort,
}: {
  filters: Filters;
  sort: Sort;
}) {
  const seed = await fetchLibraryShows(filters, sort, 0, PAGE_SEED);
  return <ShowsListClient seed={seed} filters={filters} sort={sort} />;
}
