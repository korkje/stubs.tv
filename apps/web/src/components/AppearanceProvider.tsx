"use client";

import { ThemeProvider } from "next-themes";

/**
 * Persists the light/dark/system preference and puts a `dark` class on <html>,
 * which is what Radix Themes' CSS keys its dark palette off of. The Theme
 * component itself must keep its default `appearance="inherit"` so that class
 * is what decides.
 */
export function AppearanceProvider({ children }: { children: React.ReactNode }) {
  return (
    <ThemeProvider attribute="class" defaultTheme="system" enableSystem>
      {children}
    </ThemeProvider>
  );
}
