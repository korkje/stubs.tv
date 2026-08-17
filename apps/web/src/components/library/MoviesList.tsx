import { fetchLibraryMovies } from "@/lib/library/actions";
import { type Filters, type Sort } from "@/lib/filters";
import { PAGE_SEED } from "@/lib/paging";
import { MoviesListClient } from "./MoviesListClient";

/**
 * Every movie marked as seen. Same split as the shows list: the server
 * fetches only the first page, the client pages in the rest.
 */
export async function MoviesList({
  filters,
  sort,
}: {
  filters: Filters;
  sort: Sort;
}) {
  const seed = await fetchLibraryMovies(filters, sort, 0, PAGE_SEED);
  return <MoviesListClient seed={seed} filters={filters} sort={sort} />;
}
