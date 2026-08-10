"use client";

import { useSyncExternalStore } from "react";
import { useTheme } from "next-themes";
import { Select } from "@radix-ui/themes";

const noopSubscribe = () => () => {};

/** Switches between following the OS and forcing light or dark. */
export function ThemeSelect() {
  const { theme, setTheme } = useTheme();

  // The stored preference lives in localStorage, so it cannot be known while
  // rendering on the server — render the default until hydration finishes,
  // otherwise the markup and the first client render disagree.
  const hydrated = useSyncExternalStore(
    noopSubscribe,
    () => true,
    () => false
  );

  return (
    <Select.Root
      size="1"
      value={hydrated ? theme ?? "system" : "system"}
      onValueChange={setTheme}
    >
      <Select.Trigger variant="soft" color="gray" aria-label="Colour theme" />
      <Select.Content position="popper">
        <Select.Item value="system">System</Select.Item>
        <Select.Item value="light">Light</Select.Item>
        <Select.Item value="dark">Dark</Select.Item>
      </Select.Content>
    </Select.Root>
  );
}
