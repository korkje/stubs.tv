import { Flex, Text } from "@radix-ui/themes";

/** A labelled figure, used for watch totals and per-title progress. The
 * value is usually a string; the series page passes an animated TimeFigure. */
export function Stat({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <Flex direction="column">
      <Text size="1" color="gray">
        {label}
      </Text>
      <Text size="4" weight="medium">
        {value}
      </Text>
    </Flex>
  );
}
