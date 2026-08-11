import Link from "next/link";
import { Box, Button, Container, Flex, Heading, Link as RadixLink, Text } from "@radix-ui/themes";
import { StubsMark } from "@/components/StubsMark";

export default function Home() {
  return (
    <Container size="2" px="4">
      <Flex direction="column" align="center" gap="8" py="9">
        <Flex direction="row" align="center" gap="4">
          <Box style={{ transform: "rotate(-6deg)" }}>
            <StubsMark width={120} />
          </Box>
          <Heading size="9">stubs.tv</Heading>
        </Flex>

        <Text size="4" color="gray" align="center">
          Keep track of the movies and TV shows you watch, episode by episode.
          See what you have seen, what is left, and how much time it added up to.
        </Text>

        <Box pt="4">
          <Button size="3" asChild>
            <Link href="/app">Open the app</Link>
          </Button>
        </Box>

        <Text size="2" color="gray" align="center">
          A work in progress by{" "}
          <RadixLink href="https://github.com/korkje" target="_blank" rel="noreferrer">
            korkje
          </RadixLink>{" "}
          and{" "}
          <RadixLink href="https://claude.com/claude-code" target="_blank" rel="noreferrer">
            Claude
          </RadixLink>
          .
        </Text>
      </Flex>
    </Container>
  );
}
