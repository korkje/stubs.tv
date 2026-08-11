import { Card, Flex, Skeleton } from "@radix-ui/themes";

/** Placeholder with LibraryRow's shape, so swapping in results doesn't jump. */
function LibraryRowSkeleton() {
  return (
    <Card>
      <Flex gap="4" align="start">
        <Skeleton width="56px" height="84px" style={{ borderRadius: "var(--radius-2)" }} />
        <Flex direction="column" gap="2" flexGrow="1" pt="1">
          <Skeleton width="40%" height="16px" />
          <Skeleton width="25%" height="12px" />
          <Skeleton width="90%" height="12px" />
          <Skeleton width="75%" height="12px" />
        </Flex>
      </Flex>
    </Card>
  );
}

/** Loading state for the library lists and search results. */
export function ListSkeleton({ rows = 4 }: { rows?: number }) {
  return (
    <Flex direction="column" gap="3" aria-label="Loading" role="status">
      {Array.from({ length: rows }, (_, i) => (
        <LibraryRowSkeleton key={i} />
      ))}
    </Flex>
  );
}
