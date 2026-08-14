"use client";

import { useTransition } from "react";
import { usePathname, useRouter } from "next/navigation";
import { Flex, IconButton, Popover, Switch, Text } from "@radix-ui/themes";
import { MixerHorizontalIcon } from "@radix-ui/react-icons";
import { serializeFilters, type Filters } from "@/lib/filters";

/**
 * The feed's configuration, behind a floating button in the bottom right.
 *
 * It used to be a filter panel, and the SQL behind the feed still accepts
 * the library's facets — but following a show *is* the feed's filter, so
 * narrowing it further answered a question nobody had asked. What is left
 * is one setting: whether episodes already seen stay visible.
 *
 * That one switch still lives in a popover rather than on the button
 * itself, because the obvious icon for it — the eye — is the mark-seen
 * verb everywhere else in the app, and a floating eye over the feed reads
 * as "mark all of this". The button is a dial icon; the switch says in
 * words what it does. The button turns amber while the setting is on, so
 * a feed showing watched rows never looks like the default.
 *
 * The button floats within the feed's column, not the viewport: the fixed
 * wrapper spans the screen but is capped at the feed Container's own width
 * and padding, so on a wide monitor it sits at the content's edge instead
 * of drifting to the far corner of the window.
 */
export function FeedConfigButton({ filters }: { filters: Filters }) {
  const router = useRouter();
  const pathname = usePathname();
  const [isPending, startTransition] = useTransition();

  const on = filters.includeWatched;

  const setIncludeWatched = (includeWatched: boolean) => {
    const search = serializeFilters({ ...filters, includeWatched }).toString();
    // scroll: false — the feed restores its own position around Today on
    // mount, and letting the router jump to the top first would show that
    // happening.
    startTransition(() =>
      router.replace(search ? `${pathname}?${search}` : pathname, { scroll: false })
    );
  };

  return (
    <Flex
      justify="end"
      style={{
        position: "fixed",
        left: 0,
        right: 0,
        // Clear of the iOS home indicator and any browser chrome that sits
        // over the bottom of the viewport.
        bottom: "calc(var(--space-4) + env(safe-area-inset-bottom))",
        // The feed page is a Container size 3 with px 4; this mirrors both.
        maxWidth: "var(--container-3, 880px)",
        marginInline: "auto",
        paddingInline: "max(var(--space-4), env(safe-area-inset-right))",
        // The wrapper spans the screen; only the button should catch taps.
        pointerEvents: "none",
        zIndex: 9,
      }}
    >
      <Popover.Root>
        <Popover.Trigger>
          <IconButton
            size="4"
            radius="full"
            color={on ? "amber" : "gray"}
            variant={on ? "solid" : "surface"}
            loading={isPending}
            aria-label="Feed options"
            style={{ pointerEvents: "auto", boxShadow: "var(--shadow-5)" }}
          >
            <MixerHorizontalIcon width="20" height="20" />
          </IconButton>
        </Popover.Trigger>

        <Popover.Content side="top" align="end">
          <Text as="label" size="2">
            <Flex gap="2" align="center">
              <Switch
                checked={on}
                onCheckedChange={setIncludeWatched}
              />
              Include episodes I have seen
            </Flex>
          </Text>
        </Popover.Content>
      </Popover.Root>
    </Flex>
  );
}
