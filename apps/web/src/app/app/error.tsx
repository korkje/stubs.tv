"use client";

import Link from "next/link";
import { Button, Card, Code, Container, Flex, Text } from "@radix-ui/themes";

/**
 * Route-level error boundary for everything under /app — the nav stays put,
 * the page area explains itself. It exists so that a server component
 * throwing (the convention for a failed database read) lands somewhere
 * designed rather than on Next's bare default page.
 *
 * The message is deliberately generic: in production Next strips a server
 * error's message and leaves only a digest, so there is nothing specific to
 * show. The digest gets one small line — it is what connects a user's
 * screenshot to the worker's logs.
 */
export default function AppError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <Container size="3" px="4" pt="5">
      <Card>
        <Flex direction="column" align="start" gap="3" p="2">
          <Text weight="medium">Something went wrong.</Text>
          <Text color="gray" size="2">
            The page hit an error while loading. It has been logged; trying
            again may well work.
          </Text>
          <Flex gap="3" align="center">
            <Button onClick={reset}>Try again</Button>
            <Button asChild variant="soft" color="gray">
              <Link href="/app">Go to the feed</Link>
            </Button>
          </Flex>
          {error.digest && (
            <Text size="1" color="gray">
              Error reference: <Code variant="ghost">{error.digest}</Code>
            </Text>
          )}
        </Flex>
      </Card>
    </Container>
  );
}
