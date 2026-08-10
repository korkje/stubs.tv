import Link from "next/link";
import { Box, Button, Container, Flex, Heading, Text } from "@radix-ui/themes";
import { StubsMark } from "@/components/StubsMark";

export default function Home() {
  return (
    <Container size="2" px="4">
      <Flex direction="column" align="center" gap="8" py="9">
        <Flex direction="row" align="center" gap="4">
          <Box style={{ transform: "rotate(-6deg)" }}>
            <StubsMark width={120} />
          </Box>
          <Heading size="9">
            stubs.tv
          </Heading>
        </Flex>
        <Text size="4" color="gray" align="center">
          Keep your ticket stubs. Track the movies and TV shows you watch, and
          see your watching life laid out in front of you.
        </Text>
        <Box pt="4">
          <Button size="3" asChild>
            <Link href="/app">Open the app</Link>
          </Button>
        </Box>
      </Flex>
    </Container>
  );
}
