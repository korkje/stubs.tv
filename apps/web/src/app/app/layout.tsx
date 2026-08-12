import Link from "next/link";
import { Box, Container, Flex } from "@radix-ui/themes";
import { createClient } from "@/lib/supabase/server";
import { NavLinks } from "@/components/NavLinks";
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
    <Box>
      {/* Sticky so the feed's long timeline always has the nav in reach.
          Opaque on purpose: iOS Safari paints its own chrome by extending
          the page background above the viewport, and a translucent blurred
          bar visibly seams against that strip. */}
      <Box
        asChild
        py="3"
        position="sticky"
        top="0"
        style={{
          zIndex: 10,
          backgroundColor: "var(--color-background)",
          borderBottom: "1px solid var(--gray-a6)",
        }}
      >
        <header>
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
      </Box>
      <Box py="5">{children}</Box>
    </Box>
  );
}
