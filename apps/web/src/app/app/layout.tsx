import Link from "next/link";
import { Box, Button, Container, Flex, Link as RadixLink, Separator } from "@radix-ui/themes";
import { StubsMark } from "@/components/StubsMark";
import { ThemeToggle } from "@/components/ThemeToggle";
import { signout } from "@/app/login/actions";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <Box>
      <Box asChild py="3">
        <header>
          <Container size="4" px="4">
            <Flex align="center" justify="between" gap="4">
              <Flex align="center" gap="5">
                <Link href="/app" aria-label="stubs home">
                  <Box style={{ transform: "rotate(-6deg)", display: "flex" }}>
                    <StubsMark width={52} />
                  </Box>
                </Link>
                <Flex asChild align="center" gap="4">
                  <nav>
                    <RadixLink asChild size="2" color="gray" highContrast underline="hover">
                      <Link href="/app/shows">Shows</Link>
                    </RadixLink>
                    <RadixLink asChild size="2" color="gray" highContrast underline="hover">
                      <Link href="/app/films">Films</Link>
                    </RadixLink>
                    <RadixLink asChild size="2" color="gray" highContrast underline="hover">
                      <Link href="/app/search">Search</Link>
                    </RadixLink>
                  </nav>
                </Flex>
              </Flex>
              <Flex align="center" gap="3">
                <ThemeToggle />
                <form action={signout}>
                  <Button variant="soft" color="gray" size="2">
                    Sign out
                  </Button>
                </form>
              </Flex>
            </Flex>
          </Container>
        </header>
      </Box>
      <Separator size="4" />
      <Box py="5">{children}</Box>
    </Box>
  );
}
