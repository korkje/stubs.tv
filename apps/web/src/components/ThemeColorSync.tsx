"use client";

import { useEffect } from "react";
import { useTheme } from "next-themes";

/**
 * Keeps the theme-color meta tag in step with the chosen appearance, so iOS
 * Safari tints its toolbars correctly after a toggle — the head script only
 * covers the initial load.
 */
export function ThemeColorSync() {
  const { resolvedTheme } = useTheme();

  useEffect(() => {
    if (!resolvedTheme) return;
    document
      .querySelector('meta[name="theme-color"]')
      ?.setAttribute("content", resolvedTheme === "dark" ? "#111111" : "#ffffff");
  }, [resolvedTheme]);

  return null;
}
