import { Flex, Text } from "@radix-ui/themes";

/** A labelled figure, used for watch totals and per-title progress. */
export function Stat({ label, value }: { label: string; value: string }) {
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
