"use client";

import { createContext, useCallback, useContext, useState } from "react";

interface LibraryCounts {
  shows: number;
  movies: number;
  adjustShows: (delta: number) => void;
  adjustMovies: (delta: number) => void;
}

const Context = createContext<LibraryCounts | null>(null);

/**
 * The tab counts, live across client-side membership changes. The library
 * surface never revalidates itself (see ADR-0012), so the server-rendered
 * counts go stale the moment a toggle drops or keeps a row — but the counts
 * ARE membership (series_progress rows, movies marked seen), and the lists
 * know exactly when membership changes: the toggles adjust by ±1 when the
 * server confirms one. Adjustments key off the action result, not off row
 * removal, so a rapid toggle-off-toggle-on nets to zero even when the
 * removal itself was skipped.
 *
 * Every navigation re-renders the page with fresh server counts; when the
 * seed props change, they win — the deltas only ever bridge the gap between
 * two server renders.
 */
export function LibraryCountsProvider({
  shows,
  movies,
  children,
}: {
  shows: number;
  movies: number;
  children: React.ReactNode;
}) {
  const [state, setState] = useState({ seedShows: shows, seedMovies: movies, shows, movies });
  if (state.seedShows !== shows || state.seedMovies !== movies) {
    setState({ seedShows: shows, seedMovies: movies, shows, movies });
  }

  const adjustShows = useCallback(
    (delta: number) =>
      setState((prev) => ({ ...prev, shows: Math.max(0, prev.shows + delta) })),
    []
  );
  const adjustMovies = useCallback(
    (delta: number) =>
      setState((prev) => ({ ...prev, movies: Math.max(0, prev.movies + delta) })),
    []
  );

  return (
    <Context.Provider
      value={{ shows: state.shows, movies: state.movies, adjustShows, adjustMovies }}
    >
      {children}
    </Context.Provider>
  );
}

export function useLibraryCounts(): LibraryCounts {
  const counts = useContext(Context);
  if (!counts)
    throw new Error("useLibraryCounts requires a LibraryCountsProvider above it");
  return counts;
}
