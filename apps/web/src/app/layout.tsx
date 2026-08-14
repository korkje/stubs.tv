import type { Metadata } from "next";
import { Box, Flex, Theme } from "@radix-ui/themes";
import { AppearanceProvider } from "@/components/AppearanceProvider";
import { SiteFooter } from "@/components/SiteFooter";
import "@radix-ui/themes/styles.css";
import "./globals.css";

export const metadata: Metadata = {
  title: "stubs.tv",
  description:
    "Keep track of the movies and TV shows you watch, episode by episode.",
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
            {/* The column fills the viewport and the content grows into
                whatever the footer does not use, which pins the footer to the
                bottom of a page too short to reach it on its own — every
                signed-out page, and the app's emptier states. dvh rather than
                vh so the mobile toolbars collapsing does not leave a strip of
                background below it. */}
            <Flex direction="column" minHeight="100dvh">
              <Box flexGrow="1">{children}</Box>
              <SiteFooter />
            </Flex>
          </Theme>
        </AppearanceProvider>
      </body>
    </html>
  );
}
