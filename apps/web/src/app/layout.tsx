import type { Metadata } from "next";
import { Theme } from "@radix-ui/themes";
import { AppearanceProvider } from "@/components/AppearanceProvider";
import "@radix-ui/themes/styles.css";
import "./globals.css";

export const metadata: Metadata = {
  title: "stubs",
  description: "Keep your ticket stubs — track the movies and TV shows you watch.",
};

/**
 * Applies the stored appearance before the first paint.
 *
 * next-themes ships its own version of this, but renders it inside <body> —
 * by then the stylesheet has already painted in light, which is the flash.
 * Running it in <head> is the only way to be ahead of that. It reads the same
 * localStorage key next-themes writes, so the two always agree.
 */
const NO_FLASH_SCRIPT = `(function () {
  try {
    var stored = localStorage.getItem("theme");
    var dark =
      stored === "dark" ||
      ((!stored || stored === "system") &&
        window.matchMedia("(prefers-color-scheme: dark)").matches);
    if (dark) document.documentElement.classList.add("dark");
    var meta = document.querySelector('meta[name="theme-color"]');
    if (meta) meta.setAttribute("content", dark ? "#111111" : "#ffffff");
  } catch (e) {}
})();`;

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        {/* Tints the browser chrome on iOS; kept in sync with the theme. */}
        <meta name="theme-color" content="#ffffff" />
        <script dangerouslySetInnerHTML={{ __html: NO_FLASH_SCRIPT }} />
      </head>
      <body>
        <AppearanceProvider>
          <Theme accentColor="amber" grayColor="sand" radius="large">
            {children}
          </Theme>
        </AppearanceProvider>
      </body>
    </html>
  );
}
