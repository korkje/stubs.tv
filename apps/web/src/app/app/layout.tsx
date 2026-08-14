import Link from "next/link";
import { Box, Container, Flex } from "@radix-ui/themes";
import { createClient } from "@/lib/supabase/server";
import { NavLinks } from "@/components/NavLinks";
import { SiteFooter } from "@/components/SiteFooter";
import { StubsMark } from "@/components/StubsMark";
import { UserMenu } from "@/components/UserMenu";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  // The avatar wants a letter; the display name is the honest source and the
  // email the fallback.
  const supabase = await createClient();
  const [{ data: profile }, { data: userData }] = await Promise.all([
    supabase.from("profiles").select("display_name").maybeSingle(),
    supabase.auth.getUser(),
  ]);
  const initial = (
    profile?.display_name?.trim() ||
    userData?.user?.email ||
    "?"
  )[0].toUpperCase();

  return (
    // A column as tall as the viewport, so the footer below sits on the bottom
    // edge of a page too short to reach it on its own — the emptier states, and
    // anything that renders while the real content is still loading. The
    // padding is inside that height (border-box), so a short page comes to
    // exactly one screen and grows no scrollbar. dvh rather than vh to match
    // html/body in globals.css: with vh, the mobile toolbars collapsing would
    // leave a strip of background below the footer.
    <Flex direction="column" minHeight="100dvh" pt="var(--nav-height)">
      {/* Pinned to the top so the feed's long timeline always has the nav in
          reach — and fixed rather than sticky. A sticky element's painted
          position is a function of the scroll offset, and iOS Safari catches up
          on that a beat late, so every hop to or from the feed flicked the bar:
          the feed opens scrolled to Today and the router resets to the top on
          the way out, which moves the offset in one step both times. A fixed
          bar is painted against the viewport and has nothing to catch up on.
          The cost is that it no longer occupies space, hence --nav-height above
          and the pinned height below — one value, so the bar and the gap left
          for it cannot drift apart.
          Opaque on purpose: iOS Safari paints its own chrome by extending
          the page background above the viewport, and a translucent blurred
          bar visibly seams against that strip. */}
      <Flex
        asChild
        align="center"
        position="fixed"
        top="0"
        left="0"
        right="0"
        height="var(--nav-height)"
        style={{
          zIndex: 10,
          backgroundColor: "var(--color-background)",
          borderBottom: "1px solid var(--gray-a6)",
        }}
      >
        <header>
          {/* Container brings its own flex-grow, so it fills the bar's width
              and the align above centres the row in its height. */}
          <Container size="3" px="4">
            <Flex align="center" justify="between" gap="3">
              <Flex align="center" gap={{ initial: "3", sm: "5" }}>
                <Link href="/app" aria-label="stubs.tv home">
                  <Box style={{ transform: "rotate(-6deg)", display: "flex" }}>
                    <StubsMark width={52} />
                  </Box>
                </Link>
                <Flex asChild align="center" gap={{ initial: "3", sm: "4" }}>
                  <nav>
                    <NavLinks />
                  </nav>
                </Flex>
              </Flex>
              <Flex align="center" gap="3" flexShrink="0">
                <UserMenu initial={initial} />
              </Flex>
            </Flex>
          </Container>
        </header>
      </Flex>
      <Box py="5" flexGrow="1">
        {children}
      </Box>
      <SiteFooter />
    </Flex>
  );
}
