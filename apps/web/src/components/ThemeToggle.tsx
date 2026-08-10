"use client";

import { useSyncExternalStore } from "react";
import { useTheme } from "next-themes";
import { IconButton, Tooltip } from "@radix-ui/themes";
import { MoonIcon, SunIcon } from "@radix-ui/react-icons";

const noopSubscribe = () => () => {};

/**
 * One button, two visible states — but three stored ones.
 *
 * Clicking flips the appearance. If the result happens to match the operating
 * system, the preference is stored as "system" so the app keeps following it;
 * otherwise it is stored as an explicit override. That keeps system-following
 * the norm without needing a third button, and needs nothing recorded: the OS
 * value can simply be read at the moment of the click.
 *
 * An explicit override deliberately stays an override even if the OS later
 * drifts into agreement with it — silently re-adopting "system" would make the
 * app flip on some later OS change the user never asked for.
 */
export function ThemeToggle() {
  const { theme, resolvedTheme, systemTheme, setTheme } = useTheme();

  // Only the tooltip needs the resolved value during render; the icons
  // themselves are chosen in CSS from the `dark` class, so they are correct
  // on first paint rather than after hydration.
  const hydrated = useSyncExternalStore(
    noopSubscribe,
    () => true,
    () => false
  );

  const label = !hydrated
    ? "Colour theme"
    : theme === "system"
      ? `Following system (${resolvedTheme})`
      : resolvedTheme === "dark"
        ? "Dark"
        : "Light";

  return (
    <Tooltip content={label}>
      <IconButton
        radius="full"
        variant="soft"
        color="gray"
        aria-label={label}
        onClick={() => {
          const next = resolvedTheme === "dark" ? "light" : "dark";
          setTheme(next === systemTheme ? "system" : next);
        }}
      >
        <SunIcon className="theme-icon-light" />
        <MoonIcon className="theme-icon-dark" />
      </IconButton>
    </Tooltip>
  );
}
