import Link from "next/link";
import { Box, Button, Container, Flex, Heading, Text } from "@radix-ui/themes";

export default function Home() {
  return (
    <Container size="2" px="4">
      <Flex direction="column" align="center" gap="4" py="9">
        <Heading size="9">stubs</Heading>
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
