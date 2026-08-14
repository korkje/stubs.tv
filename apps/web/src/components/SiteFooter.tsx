import { Flex, Link as RadixLink, Text } from "@radix-ui/themes";

/**
 * Attribution for TheTVDB, which our licence requires us to show wherever
 * their metadata appears. That is everything under /app, so it lives in that
 * layout rather than being repeated per route — and not in the root layout,
 * because the marketing and auth pages show no metadata to credit.
 *
 * The app layout is also what keeps it at the bottom: a page shorter than the
 * viewport would otherwise leave the footer floating in the middle of the
 * screen.
 */
export function SiteFooter() {
  return (
    <Flex asChild justify="center" px="4" py="5">
      <footer>
        <Text size="1" color="gray" align="center">
          Metadata provided by{" "}
          <RadixLink
            href="https://www.thetvdb.com"
            target="_blank"
            rel="noreferrer"
          >
            TheTVDB
          </RadixLink>
        </Text>
      </footer>
    </Flex>
  );
}
