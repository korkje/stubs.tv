import type { Metadata } from "next";
import Link from "next/link";
import {
  Box,
  Container,
  Flex,
  Heading,
  Link as RadixLink,
  Text,
} from "@radix-ui/themes";
import { StubsMark } from "@/components/StubsMark";
import { TvTimeImporter } from "@/components/import/TvTimeImporter";

export const metadata: Metadata = {
  title: "Import your TV Time export — stubs.tv",
  description:
    "TV Time's export is keyed by TheTVDB ids — the ids stubs.tv runs on. Shows and episodes import exactly: no matching, no guessing. Preview your export free, in your browser.",
};

/**
 * The durable public landing for "import TV Time export" searches — worth
 * more than any launch post, because the preview underneath is the real
 * importer running client-side (ADR-0015): a logged-out stranger can see
 * exactly what their archive holds before being asked for anything.
 */
export default function TvTimeImportPage() {
  return (
    <Container size="2" px="4">
      <Flex direction="column" gap="5" py="9">
        {/* The mark must sit outside any color="gray" Radix component:
            that prop remaps the --accent-* scale for its whole subtree, and
            the ticket body is painted with var(--accent-9) — inside a gray
            link the brand mark silently turns gray. Gray goes on the Text
            alone; the plain next/link matches the app header's pattern. */}
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

        <Heading size="7">Bring your TV Time history home</Heading>
        <Text size="3" color="gray">
          TV Time shut down in July 2026 and deleted its users&apos; data. If
          you saved your GDPR export, it is a password-protected ZIP — and it
          is keyed by TheTVDB ids, the same catalogue stubs.tv runs on. That
          means your shows and episodes import <strong>exactly</strong>: no
          fuzzy matching, no &quot;did you mean&quot;, nothing to confirm.
          Films are the one exception (TV Time stored those by title only), so
          anything ambiguous is left for you to confirm rather than guessed.
        </Text>
        <Text size="3" color="gray">
          Your export also contains your old password hash, login tokens and
          IP history. That is why parsing happens entirely in your browser:
          the ZIP and its password never touch our servers, only the watch
          history you choose to import does. Drop the file below to see what
          is inside — free, no account needed.
        </Text>

        <TvTimeImporter mode="public" />

        <Text size="2" color="gray">
          stubs.tv is a calm tracker for movies and TV — episode-level
          history, an up-next feed, and your data always exportable. It is
          fair-source and can be self-hosted, importer included.{" "}
          <RadixLink asChild>
            <Link href="/">More about stubs.tv</Link>
          </RadixLink>
          .
        </Text>
      </Flex>
    </Container>
  );
}
