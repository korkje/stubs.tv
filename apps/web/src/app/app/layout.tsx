import Link from "next/link";
import { Box, Button, Container, Flex } from "@radix-ui/themes";
import { ExitIcon } from "@radix-ui/react-icons";
import { NavLinks } from "@/components/NavLinks";
import { StubsMark } from "@/components/StubsMark";
import { ThemeToggle } from "@/components/ThemeToggle";
import { signout } from "@/app/login/actions";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <Box>
      {/* Sticky so the feed's long timeline always has the nav in reach.
          Translucent over a blur, so rows sliding beneath stay legible as
          context without competing with the controls. */}
      <Box
        asChild
        py="3"
        position="sticky"
        top="0"
        style={{
          zIndex: 10,
          backgroundColor: "color-mix(in srgb, var(--color-background) 85%, transparent)",
          backdropFilter: "blur(8px)",
          WebkitBackdropFilter: "blur(8px)",
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
                <ThemeToggle />
                <form action={signout}>
                  {/* Drops to icon-only on phones, where the full nav plus a
                      worded button overflows the width. */}
                  <Button variant="soft" color="gray" size="2" aria-label="Sign out">
                    <ExitIcon />
                    <span className="label-when-room">Sign out</span>
                  </Button>
                </form>
              </Flex>
            </Flex>
          </Container>
        </header>
      </Box>
      <Box py="5">{children}</Box>
    </Box>
  );
}
