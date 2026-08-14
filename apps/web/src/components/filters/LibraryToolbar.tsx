"use client";

import { useEffect, useState, useTransition } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import {
  Badge,
  Box,
  Button,
  Card,
  Flex,
  IconButton,
  Popover,
  SegmentedControl,
  Select,
  Spinner,
  Text,
  TextField,
} from "@radix-ui/themes";
import {
  CaretSortIcon,
  Cross2Icon,
  MagnifyingGlassIcon,
  MixerHorizontalIcon,
} from "@radix-ui/react-icons";
import {
  DEFAULT_SORT,
  NO_FILTERS,
  STATUSES,
  activeCount,
  serializeFilters,
  type Filters,
  type RuntimeScale,
  type Sort,
  type SortKeyDef,
} from "@/lib/filters";
import { Collapse } from "@/components/Collapse";
import { FilterControls, ratingLabel, runtimeLabel } from "./FilterControls";

/** How long typing settles before it becomes a navigation. */
const SEARCH_DEBOUNCE_MS = 500;

/**
 * Search, filters and sort for the library, sitting below the tab bar.
 *
 * Under the tabs rather than above them on purpose: it puts the controls
 * inside the active tab's scope — which is also why everything about it is
 * a prop. Shows and Movies offer different facets, different sort keys and
 * different slider scales, and this component only knows how to lay a
 * surface's vocabulary out.
 *
 * The resting state is one row — a search field and two icon buttons. The
 * sort is a popover on its button; the filters open an inline panel when
 * the surface has a full set of facets, or a popover of their own when it
 * has few (`compact`). What cannot be allowed to rest is the *fact* that a
 * filter or sort is on: a narrowed list that looks complete is the trap,
 * so both buttons wear their state (colour, and a count on the filters)
 * while shut.
 *
 * All state is the URL. This component only computes the next query string
 * and navigates; the server re-renders the list. That keeps filtering in SQL
 * (the 10ms CPU ceiling leaves no room to narrow a list here) and makes
 * every view a link someone can send to someone else.
 */
export function LibraryToolbar({
  filters,
  sort,
  facets,
  sortKeys,
  searchPlaceholder,
  runtime,
  compact = false,
}: {
  filters: Filters;
  sort: Sort;
  facets: readonly (keyof Filters)[];
  sortKeys: readonly SortKeyDef[];
  searchPlaceholder: string;
  runtime: RuntimeScale;
  /**
   * Filters in a popover instead of the inline panel — for a facet set
   * small enough that a full-width panel would be mostly air.
   */
  compact?: boolean;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const [isPending, startTransition] = useTransition();

  // Panel state is deliberately local rather than in the URL: which filters
  // are applied is worth sharing, whether a drawer happened to be open is
  // not. Unused in compact mode, where the popover manages itself.
  const [filtersOpen, setFiltersOpen] = useState(false);

  // The field owns its text while typing — round-tripping every keystroke
  // through a navigation would fight the cursor.
  const [draft, setDraft] = useState(filters.query);

  // ...but a change from elsewhere (the back button, the search chip's
  // clear) still has to reach it. "Elsewhere" is the crux: the component's
  // own debounced navigation also arrives back through this prop, and by
  // then the field may hold newer keystrokes — syncing on that echo ate the
  // end of whatever was typed during the round-trip. `sent` remembers the
  // last query this component itself navigated to, so only a query it did
  // not send counts as external. Adjusting during render rather than in an
  // effect: React re-runs this component before touching the DOM, so the
  // field never paints the stale value, and there is no second commit.
  const [sent, setSent] = useState(filters.query);
  const [synced, setSynced] = useState(filters.query);
  if (filters.query !== synced) {
    setSynced(filters.query);
    if (filters.query !== sent) {
      setSent(filters.query);
      setDraft(filters.query);
    }
  }

  const navigate = (next: Filters, nextSort: Sort = sort) => {
    const query = serializeFilters(next, nextSort);
    // The tab is not a filter; it must survive every change here.
    const tab = params.get("tab");
    if (tab) query.set("tab", tab);
    const search = query.toString();
    startTransition(() =>
      router.replace(search ? `${pathname}?${search}` : pathname, { scroll: false })
    );
  };

  // Debounce typing into a navigation. The guard is what stops a change that
  // came *from* the URL being echoed straight back to it: after the sync
  // above, draft already equals filters.query, so there is nothing to do.
  useEffect(() => {
    if (draft === filters.query) return;
    const id = setTimeout(() => {
      setSent(draft);
      navigate({ ...filters, query: draft });
    }, SEARCH_DEBOUNCE_MS);
    return () => clearTimeout(id);
    // navigate closes over the current filters and sort, both of which are
    // in the dependency list by way of `filters`; adding the function itself
    // would re-arm the timer on every render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [draft, filters]);

  const active = activeCount(filters);
  // The sort param is present exactly when the sort is not the default —
  // the serializer already knows, so ask it instead of restating the rule.
  const sorted = serializeFilters(NO_FILTERS, sort).size > 0;

  // No "Filters" heading — the panel opens out of a button that says so,
  // and the sort popover already set the precedent of trusting that. No
  // "Clear all" in here either: it came and went with the first and last
  // active filter, resizing the panel and shoving the list below it
  // mid-animation. The chips row keeps the one-tap way out.
  const filterPanel = (
    <FilterControls
      filters={filters}
      facets={facets}
      runtime={runtime}
      columns={compact ? "1" : { initial: "1", sm: "2" }}
      onChange={(next) => navigate(next)}
    />
  );

  const filterButton = (
    <IconButton
      size="3"
      variant={active > 0 ? "solid" : "surface"}
      color={active > 0 ? "amber" : "gray"}
      aria-label={active > 0 ? `Filters (${active} active)` : "Filters"}
      aria-expanded={compact ? undefined : filtersOpen}
      onClick={compact ? undefined : () => setFiltersOpen((open) => !open)}
    >
      <MixerHorizontalIcon width="18" height="18" />
    </IconButton>
  );

  return (
    <Flex direction="column" gap="3">
      <Flex gap="2" align="center">
        <TextField.Root
          // size 3 is 16px: anything smaller makes iOS Safari zoom in when
          // the field is focused. It also sets the row's 40px height, which
          // the icon buttons match.
          size="3"
          placeholder={searchPlaceholder}
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          style={{ flexGrow: 1, minWidth: 0 }}
        >
          <TextField.Slot>
            {/* The magnifier doubles as the busy indicator: Spinner keeps
                its children's box, so the swap costs no layout at all —
                which is why there is no separate spinner in this row. */}
            <Spinner loading={isPending}>
              <MagnifyingGlassIcon />
            </Spinner>
          </TextField.Slot>
          {draft && (
            <TextField.Slot>
              <IconButton
                size="1"
                variant="ghost"
                color="gray"
                aria-label="Clear search"
                onClick={() => setDraft("")}
              >
                <Cross2Icon />
              </IconButton>
            </TextField.Slot>
          )}
        </TextField.Root>

        {/* The count rides on top of the button rather than inside it, so
            appearing and disappearing never resizes the row. */}
        <Box position="relative" flexShrink="0">
          {compact ? (
            <Popover.Root>
              <Popover.Trigger>{filterButton}</Popover.Trigger>
              <Popover.Content
                side="bottom"
                align="end"
                width="min(380px, calc(100vw - var(--space-6)))"
              >
                {filterPanel}
              </Popover.Content>
            </Popover.Root>
          ) : (
            filterButton
          )}
          {active > 0 && (
            <Badge
              color="amber"
              variant="solid"
              highContrast
              style={{
                position: "absolute",
                top: -6,
                right: -6,
                pointerEvents: "none",
              }}
            >
              {active}
            </Badge>
          )}
        </Box>

        <Popover.Root>
          <Popover.Trigger>
            <IconButton
              size="3"
              variant={sorted ? "solid" : "surface"}
              color={sorted ? "amber" : "gray"}
              aria-label="Sort"
              style={{ flexShrink: 0 }}
            >
              <CaretSortIcon width="20" height="20" />
            </IconButton>
          </Popover.Trigger>
          <Popover.Content
            side="bottom"
            align="end"
            maxWidth="calc(100vw - var(--space-6))"
          >
            {/* One row, sized to its content: field picker and direction.
                Ties break on name A–Z implicitly, so there is no "then by"
                to spend a second row on. */}
            <Flex gap="2" align="center" wrap="wrap">
              <Text size="2" color="gray">
                Sort by
              </Text>
              <Select.Root
                value={sort.key}
                onValueChange={(value) => {
                  const key = sortKeys.find((k) => k.value === value)!;
                  // Picking a field means its natural direction: nobody
                  // switches to "My rating" wanting worst first.
                  navigate(filters, {
                    key: key.value,
                    ascending: key.defaultAscending,
                  });
                }}
              >
                <Select.Trigger />
                <Select.Content>
                  {sortKeys.map((key) => (
                    <Select.Item key={key.value} value={key.value}>
                      {key.label}
                    </Select.Item>
                  ))}
                </Select.Content>
              </Select.Root>
              <SegmentedControl.Root
                value={sort.ascending ? "asc" : "desc"}
                onValueChange={(value) =>
                  navigate(filters, { ...sort, ascending: value === "asc" })
                }
              >
                <SegmentedControl.Item value="asc">Asc</SegmentedControl.Item>
                <SegmentedControl.Item value="desc">Desc</SegmentedControl.Item>
              </SegmentedControl.Root>
            </Flex>
          </Popover.Content>
        </Popover.Root>
      </Flex>

      {!compact && (
        <Collapse>
          {filtersOpen ? (
            // The theme's translucent panels give the card a backdrop-filter,
            // and WebKit does not paint text under one while an ancestor
            // animates opacity — in Safari the whole panel opened blank and
            // its text appeared only once the Collapse settled. Over the flat
            // page background the blur changes nothing visible, so it is the
            // right side to give up. (If Safari ever regresses again here,
            // the other lever is dropping opacity from Collapse itself.)
            <Card style={{ "--backdrop-filter-panel": "none" } as React.CSSProperties}>
              <Box p="1">{filterPanel}</Box>
            </Card>
          ) : null}
        </Collapse>
      )}

      {/* Shut, the chips are how the filters stay visible and removable
          without reopening the panel. Open, the controls already show their
          own state and repeating it here would just be noise. The sort gets
          a chip too — it narrows nothing, but a non-default order is the
          same kind of silent state, and this is its only one-tap way back. */}
      {(compact || !filtersOpen) && (active > 0 || sorted) && (
        <Flex gap="2" wrap="wrap" align="center">
          {filters.status && (
            <Chip
              label={
                STATUSES.find((s) => s.value === filters.status)?.label ??
                filters.status
              }
              onClear={() => navigate({ ...filters, status: null })}
            />
          )}
          {filters.following !== null && (
            <Chip
              label={filters.following ? "Following" : "Not following"}
              onClear={() => navigate({ ...filters, following: null })}
            />
          )}
          {filters.behind !== null && (
            <Chip
              label={filters.behind ? "Behind" : "Caught up"}
              onClear={() => navigate({ ...filters, behind: null })}
            />
          )}
          {filters.rating && (
            <Chip
              label={`Rated ${ratingLabel(filters.rating)}`}
              onClear={() => navigate({ ...filters, rating: null })}
            />
          )}
          {filters.runtime && (
            <Chip
              label={runtimeLabel(filters.runtime, runtime.max)}
              onClear={() => navigate({ ...filters, runtime: null })}
            />
          )}
          {sorted && (
            <Chip
              label={`Sort: ${
                sortKeys.find((k) => k.value === sort.key)?.label ?? sort.key
              } ${sort.ascending ? "↑" : "↓"}`}
              onClear={() => navigate(filters, DEFAULT_SORT)}
            />
          )}
          {active + (sorted ? 1 : 0) > 1 && (
            <Button
              size="1"
              variant="ghost"
              color="gray"
              // The search text survives: it is not a filter, has no chip
              // here, and wiping state this row never showed would make
              // "clear all" mean more than what is on screen.
              onClick={() =>
                navigate({ ...NO_FILTERS, query: filters.query }, DEFAULT_SORT)
              }
            >
              Clear all
            </Button>
          )}
        </Flex>
      )}
    </Flex>
  );
}

/** Radix Themes has no chip; a Badge with a close button is the shape. */
function Chip({ label, onClear }: { label: string; onClear: () => void }) {
  return (
    <Badge size="2" variant="soft" color="amber">
      {label}
      <IconButton
        size="1"
        variant="ghost"
        color="amber"
        aria-label={`Clear ${label}`}
        onClick={onClear}
      >
        <Cross2Icon />
      </IconButton>
    </Badge>
  );
}
