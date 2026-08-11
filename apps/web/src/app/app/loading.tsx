import { Flex, Spinner } from "@radix-ui/themes";

/**
 * Route-level loading state for everything under /app. The nav stays put;
 * the page area shows a spinner while the destination renders — which
 * matters most on first visits to a title, where ingestion can take seconds.
 */
export default function Loading() {
  return (
    <Flex justify="center" py="9">
      <Spinner size="3" />
    </Flex>
  );
}
