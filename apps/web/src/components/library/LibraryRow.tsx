import Link from "next/link";
import { Badge, Card, Flex, Text } from "@radix-ui/themes";
import { Poster } from "@/components/Poster";
import { formatRuntime } from "@/lib/format";

/**
 * One entry in the Shows or Movies list. Both use this so the two tabs stay
 * identical in shape: title, then a line of facts, then the synopsis.
 *
 * The synopsis is clamped rather than truncated — Radix's `truncate` is
 * single-line only.
 */
export function LibraryRow({
  href,
  name,
  posterUrl,
  date,
  runtimeMin,
  rating,
  overview,
  badge,
  titleIcon,
}: {
  href: string;
  name: string;
  posterUrl: string | null;
  /** ISO date or a bare year; only the year is shown. */
  date: string | null;
  runtimeMin: number | null;
  rating: number | null;
  overview: string | null;
  /** Optional trailing badge, e.g. how many episodes are left to watch. */
  badge?: React.ReactNode;
  /** Optional icon after the title, e.g. the followed star. */
  titleIcon?: React.ReactNode;
}) {
  return (
    <Card asChild>
      <Link href={href}>
        <Flex gap="4" align="start">
          <Poster url={posterUrl} alt={name} width={56} />
          {/* flexGrow makes the column span the card even when the text is
              short, so the follow star always sits at the right edge. */}
          <Flex direction="column" gap="1" flexGrow="1" style={{ minWidth: 0 }}>
            <Flex justify="between" align="start" gap="2">
              <Text weight="bold" size="3">
                {name}
              </Text>
              {titleIcon && (
                // Match the title's line height so the icon centers on the
                // first line even when the title wraps.
                <Flex
                  align="center"
                  flexShrink="0"
                  style={{ height: "var(--line-height-3)" }}
                >
                  {titleIcon}
                </Flex>
              )}
            </Flex>

            <Flex align="center" gap="2" wrap="wrap">
              {date && (
                <Text size="1" color="gray">
                  {date.slice(0, 4)}
                </Text>
              )}
              {runtimeMin ? (
                <Text size="1" color="gray">
                  {formatRuntime(runtimeMin)}
                </Text>
              ) : null}
              {rating ? (
                <Badge size="1" color="amber" variant="soft">
                  {rating} / 10
                </Badge>
              ) : null}
              {badge}
            </Flex>

            {overview && (
              <Text as="div" size="1" color="gray" className="clamp-summary">
                {overview}
              </Text>
            )}
          </Flex>
        </Flex>
      </Link>
    </Card>
  );
}
