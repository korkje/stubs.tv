"use client";

import { Tabs } from "@radix-ui/themes";

/**
 * The settings Tabs.Root, with one client-side addition: switching tabs
 * writes ?tab= into the URL (a shallow replace, no server round-trip), so a
 * reload — or a link copied to another device — lands on the same tab
 * instead of snapping back to the first one. The form actions already
 * redirect with ?tab= for the same reason; this covers plain clicking.
 *
 * Feedback params (saved, error, …) are scrubbed on switch: they describe
 * the submit that just happened on another tab, and surviving a reload from
 * here would re-announce a stale result.
 */
export function SettingsTabs({
  defaultValue,
  children,
}: {
  defaultValue: string;
  children: React.ReactNode;
}) {
  return (
    <Tabs.Root
      defaultValue={defaultValue}
      onValueChange={(value) => {
        const url = new URL(window.location.href);
        for (const param of [...url.searchParams.keys()]) {
          url.searchParams.delete(param);
        }
        url.searchParams.set("tab", value);
        window.history.replaceState(null, "", url);
      }}
    >
      {children}
    </Tabs.Root>
  );
}
