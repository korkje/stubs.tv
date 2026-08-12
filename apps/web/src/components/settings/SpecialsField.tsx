"use client";

import { useState } from "react";
import { Flex, RadioGroup, Switch, Text } from "@radix-ui/themes";

const OPTIONS = [
  {
    value: "uncounted",
    title: "Show, but don’t count",
    detail: "Listed on show pages, left out of progress and the home feed.",
  },
  {
    value: "counted",
    title: "Count everywhere",
    detail: "Counted in progress and part of the home feed.",
  },
  {
    value: "hidden",
    title: "Hide entirely",
    detail: "As if specials did not exist.",
  },
];

/**
 * The specials preference. Client-side so the bulk-mark switch can step
 * aside when specials are hidden outright — its value is preserved through
 * a hidden input, so flipping back does not forget the old choice.
 */
export function SpecialsField({
  initialSpecials,
  initialBulk,
}: {
  initialSpecials: string;
  initialBulk: boolean;
}) {
  const [specials, setSpecials] = useState(initialSpecials);

  return (
    <Flex direction="column" gap="3" align="start">
      <RadioGroup.Root name="specials" value={specials} onValueChange={setSpecials}>
        {OPTIONS.map((option) => (
          <RadioGroup.Item key={option.value} value={option.value}>
            <Flex direction="column">
              <Text size="2">{option.title}</Text>
              <Text size="1" color="gray">
                {option.detail}
              </Text>
            </Flex>
          </RadioGroup.Item>
        ))}
      </RadioGroup.Root>
      {specials === "hidden" ? (
        <input
          type="hidden"
          name="bulk_mark_specials"
          value={initialBulk ? "on" : ""}
        />
      ) : (
        <Text as="label" size="2">
          <Flex gap="2" align="center">
            <Switch name="bulk_mark_specials" defaultChecked={initialBulk} />
            “Mark show” also marks specials
          </Flex>
        </Text>
      )}
    </Flex>
  );
}
