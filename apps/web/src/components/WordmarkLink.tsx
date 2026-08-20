import Link from "next/link";
import { Box, Flex, Text } from "@radix-ui/themes";
import { StubsMark } from "@/components/StubsMark";

/**
 * The small mark + wordmark that heads the public pages (the TV Time
 * import landing, privacy, terms) and links back home — those pages
 * inherit only the root layout, so without this they are dead ends.
 *
 * The mark must sit outside any color="gray" Radix component: that prop
 * remaps the --accent-* scale for its whole subtree, and the ticket body
 * is painted with var(--accent-9) — inside a gray link the brand mark
 * silently turns gray. Gray goes on the Text alone; the plain next/link
 * matches the app header's pattern.
 */
export function WordmarkLink() {
  return (
    <Link
      href="/"
      aria-label="stubs.tv home"
      style={{ textDecoration: "none" }}
    >
      <Flex align="center" gap="2">
        <Box
          width="28px"
          flexShrink="0"
          style={{ transform: "rotate(-6deg)", display: "flex" }}
        >
          <StubsMark width="100%" />
        </Box>
        <Text size="2" color="gray">
          stubs.tv
        </Text>
      </Flex>
    </Link>
  );
}
