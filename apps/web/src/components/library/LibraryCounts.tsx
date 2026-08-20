"use client";

import { createContext, useCallback, useContext, useState } from "react";

interface LibraryCounts {
  shows: number;
  movies: number;
  episodeMinutes: number;
  movieMinutes: number;
  adjustShows: (delta: number) => void;
  adjustMovies: (delta: number, runtimeMin?: number | null) => void;
}

const Context = createContext<LibraryCounts | null>(null);

/**
 * The tab counts and watch-time totals, live across client-side changes.
 * The library surface never revalidates itself (see ADR-0012), so the
 * server-rendered numbers go stale the moment a toggle drops or keeps a
 * row — but the lists know exactly when things change: the toggles adjust
 * counts by ±1 (and minutes by the row's runtime) when the server confirms
 * one. Adjustments key off the action result, not off row removal, so a
 * rapid toggle-off-toggle-on nets to zero even when the removal itself was
 * skipped.
 *
 * Only movie toggles live on this page, so episode minutes never move here
 * — they are carried anyway so the totals row reads everything from one
 * place and Total time stays a sum instead of a third seed.
 *
 * Every navigation re-renders the page with fresh server counts; when the
 * seed props change, they win — the deltas only ever bridge the gap between
 * two server renders.
 */
export function LibraryCountsProvider({
  shows,
  movies,
  episodeMinutes,
  movieMinutes,
  children,
}: {
  shows: number;
  movies: number;
  episodeMinutes: number;
  movieMinutes: number;
  children: React.ReactNode;
}) {
  const [state, setState] = useState({
    seedShows: shows,
    seedMovies: movies,
    seedMovieMinutes: movieMinutes,
    shows,
    movies,
    movieMinutes,
  });
  if (
    state.seedShows !== shows ||
    state.seedMovies !== movies ||
    state.seedMovieMinutes !== movieMinutes
  ) {
    setState({
      seedShows: shows,
      seedMovies: movies,
      seedMovieMinutes: movieMinutes,
      shows,
      movies,
      movieMinutes,
    });
  }

  const adjustShows = useCallback(
    (delta: number) =>
      setState((prev) => ({ ...prev, shows: Math.max(0, prev.shows + delta) })),
    []
  );
  const adjustMovies = useCallback(
    (delta: number, runtimeMin?: number | null) =>
      setState((prev) => ({
        ...prev,
        movies: Math.max(0, prev.movies + delta),
        movieMinutes: Math.max(0, prev.movieMinutes + delta * (runtimeMin ?? 0)),
      })),
    []
  );

  return (
    <Context.Provider
      value={{
        shows: state.shows,
        movies: state.movies,
        episodeMinutes,
        movieMinutes: state.movieMinutes,
        adjustShows,
        adjustMovies,
      }}
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
