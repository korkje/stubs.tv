import Link from "next/link";
import {
  Box,
  Button,
  Container,
  Flex,
  Link as RadixLink,
  Separator,
} from "@radix-ui/themes";
import { ExitIcon } from "@radix-ui/react-icons";
import { StubsMark } from "@/components/StubsMark";
import { ThemeToggle } from "@/components/ThemeToggle";
import { signout } from "@/app/login/actions";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <Box>
      <Box asChild py="3">
        <header>
          <Container size="4" px="4">
            <Flex align="center" justify="between" gap="3">
              <Flex align="center" gap={{ initial: "3", sm: "5" }}>
                <Link href="/app" aria-label="stubs home">
                  <Box style={{ transform: "rotate(-6deg)", display: "flex" }}>
                    <StubsMark width={52} />
                  </Box>
                </Link>
                <Flex asChild align="center" gap={{ initial: "3", sm: "4" }}>
                  <nav>
                    <RadixLink asChild size="2" color="gray" highContrast underline="hover">
                      <Link href="/app">Home</Link>
                    </RadixLink>
                    <RadixLink asChild size="2" color="gray" highContrast underline="hover">
                      <Link href="/app/search">Search</Link>
                    </RadixLink>
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
      <Separator size="4" />
      <Box py="5">{children}</Box>
    </Box>
  );
}
