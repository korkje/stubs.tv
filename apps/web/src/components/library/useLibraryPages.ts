"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { PAGE_SEED, PAGE_STEP } from "@/lib/paging";

interface PagesState<T> {
  seedKey: string;
  rows: T[];
  /** Ids that arrived through paging, so their rows skip the entrance. */
  pagedIds: ReadonlySet<string>;
  hasMore: boolean;
}

/**
 * Client-held pages for a library list. The server renders the seed page;
 * everything after it arrives through `fetchPage` when the sentinel nears
 * the viewport, and the accumulated rows live here — which is what lets the
 * follow/seen toggles work without the route reloading under the user.
 *
 * A seedKey change (filters or sort changed, so the server sent a new first
 * page) resets the accumulation via adjust-during-render, deliberately
 * without remounting the host: the same AnimatedRows instance receiving the
 * new list is what animates the difference.
 *
 * The next offset is the number of rows currently held, not the number
 * fetched: a client-side removal (unfollow, unmark) also removes the row
 * from the underlying view, shifting the server's result set and the local
 * count by the same amount — they cancel. Changes made elsewhere (another
 * tab, another device) mid-scroll can still shift a page boundary; the
 * duplicate direction is deduped below, the gap direction is rare and heals
 * on the next visit — the same race the feed accepts.
 */
export function useLibraryPages<T>({
  seed,
  seedKey,
  rowId,
  fetchPage,
}: {
  seed: T[];
  seedKey: string;
  /** Stable id per row; null (a view row missing its id) never dedupes. */
  rowId: (row: T) => string | null;
  /**
   * The hook owns both the requested size and the "was the page full"
   * check, so the two cannot drift: the seed is PAGE_SEED rows, every
   * fetch after it asks for PAGE_STEP.
   */
  fetchPage: (offset: number, limit: number) => Promise<T[]>;
}) {
  const fresh = (): PagesState<T> => ({
    seedKey,
    rows: seed,
    pagedIds: new Set(),
    hasMore: seed.length === PAGE_SEED,
  });

  const [state, setState] = useState<PagesState<T>>(fresh);
  if (state.seedKey !== seedKey) setState(fresh());

  const [loading, setLoading] = useState(false);
  const busy = useRef(false);
  const sentinelRef = useRef<HTMLDivElement>(null);

  const loadMore = useCallback(async () => {
    if (busy.current) return;
    busy.current = true;
    setLoading(true);
    try {
      const page = await fetchPage(state.rows.length, PAGE_STEP);
      setState((prev) => {
        // A page requested under the old filters landing after a reset
        // would interleave rows that do not belong together — drop it.
        if (prev.seedKey !== seedKey) return prev;
        const held = new Set(prev.rows.map(rowId));
        const fresh = page.filter((row) => {
          const id = rowId(row);
          return id === null || !held.has(id);
        });
        const pagedIds = new Set(prev.pagedIds);
        for (const row of fresh) {
          const id = rowId(row);
          if (id !== null) pagedIds.add(id);
        }
        return {
          ...prev,
          rows: [...prev.rows, ...fresh],
          pagedIds,
          hasMore: page.length === PAGE_STEP,
        };
      });
    } finally {
      setLoading(false);
      busy.current = false;
    }
  }, [fetchPage, rowId, seedKey, state.rows.length]);

  // Generous margin, same as the feed: fetched and in place well before the
  // user arrives, and early is free. Appending never moves content above
  // the viewport, so auto-load is safe mid-scroll on every engine.
  useEffect(() => {
    const el = sentinelRef.current;
    if (!el || !state.hasMore) return;
    const observer = new IntersectionObserver(
      (entries) => entries.some((entry) => entry.isIntersecting) && loadMore(),
      { rootMargin: "1500px 0px" }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [loadMore, state.hasMore]);

  const updateRow = useCallback(
    (id: string, update: (row: T) => T) => {
      setState((prev) => ({
        ...prev,
        rows: prev.rows.map((row) => (rowId(row) === id ? update(row) : row)),
      }));
    },
    [rowId]
  );

  const removeRow = useCallback(
    // The predicate runs against the row's CURRENT state, which matters
    // when the removal follows an await: a second click may have re-toggled
    // the row while the first round trip ran, and removing it then would
    // disappear something the user just asked to keep.
    (id: string, when?: (row: T) => boolean) => {
      setState((prev) => ({
        ...prev,
        rows: prev.rows.filter(
          (row) => rowId(row) !== id || (when ? !when(row) : false)
        ),
      }));
    },
    [rowId]
  );

  return {
    rows: state.rows,
    pagedIds: state.pagedIds,
    hasMore: state.hasMore,
    loading,
    sentinelRef,
    updateRow,
    removeRow,
  };
}
