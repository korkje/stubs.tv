"use client";

import { useState } from "react";
import {
  Flex,
  Grid,
  SegmentedControl,
  Slider,
  Switch,
  Text,
} from "@radix-ui/themes";
import {
  RATING_MAX,
  RATING_MIN,
  RUNTIME_MIN,
  SHOW_RUNTIME,
  STATUSES,
  type Filters,
  type RuntimeScale,
  type Status,
} from "@/lib/filters";

/** "Any length", "Under 40 min", "20+ min", "20–60 min". */
export function runtimeLabel(
  runtime: [number, number] | null,
  max: number
): string {
  if (!runtime) return "Any length";
  const [lo, hi] = runtime;
  const open = lo <= RUNTIME_MIN;
  const unbounded = hi >= max;
  if (open && unbounded) return "Any length";
  if (open) return `Under ${hi} min`;
  if (unbounded) return `${lo}+ min`;
  return `${lo}–${hi} min`;
}

/** "Any rating", "7+", "5 or less", "3–7". */
export function ratingLabel(rating: [number, number] | null): string {
  if (!rating) return "Any rating";
  const [lo, hi] = rating;
  const open = lo <= RATING_MIN;
  const unbounded = hi >= RATING_MAX;
  if (open && unbounded) return "Any rating";
  if (open) return `${hi} or less`;
  if (unbounded) return `${lo}+`;
  return `${lo}–${hi}`;
}

/**
 * A labelled facet. The current value sits right-aligned on the label row,
 * so when it changes width ("Any length" → "20–60 min") it grows into the
 * empty middle of the row instead of pushing the control beside it — that
 * is the whole reason the readout is not inline with the slider.
 */
function Field({
  label,
  value,
  children,
}: {
  label: string;
  value?: string;
  children: React.ReactNode;
}) {
  return (
    <Flex direction="column" gap="2" minWidth="0">
      <Flex justify="between" align="center" gap="3">
        <Text size="2" weight="medium">
          {label}
        </Text>
        {value !== undefined && (
          <Text size="2" color="gray" style={{ fontVariantNumeric: "tabular-nums" }}>
            {value}
          </Text>
        )}
      </Flex>
      {children}
    </Flex>
  );
}

/**
 * Three answers, not two: "either" is a real state and gets a real button,
 * instead of being spelled "the toggle is off", which reads identically to
 * "the toggle means no".
 */
function TriState({
  value,
  yes,
  no,
  onChange,
}: {
  value: boolean | null;
  yes: string;
  no: string;
  onChange: (value: boolean | null) => void;
}) {
  return (
    <SegmentedControl.Root
      value={value === null ? "any" : value ? "yes" : "no"}
      onValueChange={(next) => onChange(next === "any" ? null : next === "yes")}
      {...SEGMENTED_FIT}
    >
      <SegmentedControl.Item value="any">All</SegmentedControl.Item>
      <SegmentedControl.Item value="yes">{yes}</SegmentedControl.Item>
      <SegmentedControl.Item value="no">{no}</SegmentedControl.Item>
    </SegmentedControl.Root>
  );
}

/**
 * Every segmented control here fills its parent and is allowed to compress
 * below its widest label (min-width: 0 — the default min-content floor is
 * what made these overflow into sideways scrolling on narrow screens). The
 * columns are 1fr each, so a squeeze is shared evenly; below `xs` the
 * smaller size buys the labels back the room the squeeze costs.
 *
 * Squeezed far enough, a label would rather wrap than shorten, which pushes
 * the text out of the control entirely — `.segmented-fit` in globals.css is
 * what makes it shorten instead.
 */
const SEGMENTED_FIT = {
  size: { initial: "1", xs: "2" },
  className: "segmented-fit",
  style: { width: "100%", minWidth: 0 },
} as const;

/**
 * A double-ended slider whose thumbs touching the rails mean "unbounded".
 *
 * The value on screen is local while a thumb is held: navigating on every
 * step would reload the list mid-drag, so the URL only changes on release
 * (onValueCommit). The local copy then *stays* until the new value arrives
 * back through props — dropping it on release would snap the thumb to the
 * old position for the round-trip.
 */
function RangeField({
  label,
  value,
  min,
  max,
  step,
  format,
  onCommit,
}: {
  label: string;
  value: [number, number] | null;
  min: number;
  max: number;
  step: number;
  format: (value: [number, number] | null) => string;
  onCommit: (value: [number, number] | null) => void;
}) {
  const [draft, setDraft] = useState<[number, number] | null>(null);

  // Adjust-during-render: when the committed value comes back (or changes
  // from elsewhere — back button, a chip's clear), the draft has served its
  // purpose. Compared by content; the array identity changes every render.
  const key = value ? value.join(":") : "";
  const [seen, setSeen] = useState(key);
  if (key !== seen) {
    setSeen(key);
    setDraft(null);
  }

  const shown = draft ?? value ?? ([min, max] as [number, number]);

  return (
    <Field label={label} value={format(draft ?? value)}>
      <Slider
        value={shown}
        min={min}
        max={max}
        step={step}
        minStepsBetweenThumbs={1}
        onValueChange={([lo, hi]) => setDraft([lo, hi])}
        onValueCommit={([lo, hi]) => {
          const next: [number, number] | null =
            lo <= min && hi >= max ? null : [lo, hi];
          // A drag that ends where it began is not a change.
          if ((next?.join(":") ?? "") === key) setDraft(null);
          else onCommit(next);
        }}
      />
    </Field>
  );
}

/**
 * The filter controls themselves, shared by the library toolbar and the
 * feed's sheet. It renders only the facets the surface passes in, so the two
 * cannot drift apart in behaviour while still differing in what they offer.
 *
 * Purely presentational with respect to state: it reports a whole new
 * Filters object and lets the host decide what to do with it (both hosts put
 * it in the URL).
 */
export function FilterControls({
  filters,
  facets,
  columns = { initial: "1", sm: "2" },
  runtime = SHOW_RUNTIME,
  onChange,
}: {
  filters: Filters;
  facets: readonly (keyof Filters)[];
  /**
   * Grid columns for the fields. Radix responsive values follow the
   * viewport, not the container, so a host that is narrow on a wide screen
   * (a popover) must say so itself.
   */
  columns?: React.ComponentProps<typeof Grid>["columns"];
  /** The surface's runtime slider scale — movies run far past episodes. */
  runtime?: RuntimeScale;
  onChange: (next: Filters) => void;
}) {
  const has = (facet: keyof Filters) => facets.includes(facet);
  const set = (patch: Partial<Filters>) => onChange({ ...filters, ...patch });

  const hasChoices =
    has("status") || has("following") || has("behind") || has("includeWatched");
  const hasRanges = has("rating") || has("runtime");

  // Two grids, not one: the choice controls and the sliders each share a
  // grid so same-kind fields always land on the same row — which is also
  // what guarantees the two sliders identical label-to-track spacing. A
  // grid with no fields must not render at all: it is invisible but still
  // an item of this flex, and its extra gap was a band of dead space in
  // any surface missing a whole kind (the movies popover has no choice
  // facets).
  return (
    <Flex direction="column" gap="4">
      {hasChoices && (
        <Grid columns={columns} gapX="6" gapY="4">
          {has("status") && (
            <Field label="Status">
              {/* Same shape as the other choice facets, "All" included —
                  single-select, since no real question here needs two of the
                  three statuses at once. */}
              <SegmentedControl.Root
                value={filters.status ?? "all"}
                onValueChange={(value) =>
                  set({ status: value === "all" ? null : (value as Status) })
                }
                {...SEGMENTED_FIT}
              >
                <SegmentedControl.Item value="all">All</SegmentedControl.Item>
                {STATUSES.map((status) => (
                  <SegmentedControl.Item key={status.value} value={status.value}>
                    {status.label}
                  </SegmentedControl.Item>
                ))}
              </SegmentedControl.Root>
            </Field>
          )}

          {has("following") && (
            <Field label="Following">
              <TriState
                value={filters.following}
                yes="Following"
                no="Not following"
                onChange={(following) => set({ following })}
              />
            </Field>
          )}

          {has("behind") && (
            <Field label="Progress">
              <TriState
                value={filters.behind}
                yes="Behind"
                no="Caught up"
                onChange={(behind) => set({ behind })}
              />
            </Field>
          )}

          {has("includeWatched") && (
            <Field label="Watched episodes">
              <Text as="label" size="2">
                <Flex gap="2" align="center" height="var(--space-6)">
                  <Switch
                    checked={filters.includeWatched}
                    onCheckedChange={(includeWatched) => set({ includeWatched })}
                  />
                  Include episodes I have seen
                </Flex>
              </Text>
            </Field>
          )}
        </Grid>
      )}

      {hasRanges && (
        <Grid columns={columns} gapX="6" gapY="4">
          {has("rating") && (
            <RangeField
              label="My rating"
              value={filters.rating}
              min={RATING_MIN}
              max={RATING_MAX}
              step={1}
              format={ratingLabel}
              onCommit={(rating) => set({ rating })}
            />
          )}

          {has("runtime") && (
            <RangeField
              label={runtime.label}
              value={filters.runtime}
              min={RUNTIME_MIN}
              max={runtime.max}
              step={runtime.step}
              format={(value) => runtimeLabel(value, runtime.max)}
              onCommit={(value) => set({ runtime: value })}
            />
          )}
        </Grid>
      )}
    </Flex>
  );
}
