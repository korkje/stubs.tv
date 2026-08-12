"use client";

import { useState } from "react";
import { Button, Flex, Select, Text } from "@radix-ui/themes";

/**
 * Timezone picker: the full IANA list from the browser, plus a one-click
 * "use this device's" shortcut. The value rides in a hidden input so the
 * surrounding plain form can submit it.
 */
export function TimezoneField({ initial }: { initial: string }) {
  const [value, setValue] = useState(initial || "UTC");
  const zones = Intl.supportedValuesOf("timeZone");
  const deviceZone = Intl.DateTimeFormat().resolvedOptions().timeZone;

  return (
    <Flex direction="column" gap="2" align="start">
      <input type="hidden" name="timezone" value={value === "UTC" ? "" : value} />
      <Select.Root value={value} onValueChange={setValue}>
        <Select.Trigger />
        <Select.Content position="popper">
          <Select.Item value="UTC">UTC</Select.Item>
          {zones.map((zone) => (
            <Select.Item key={zone} value={zone}>
              {zone}
            </Select.Item>
          ))}
        </Select.Content>
      </Select.Root>
      {deviceZone && value !== deviceZone && (
        <Button
          type="button"
          size="1"
          variant="ghost"
          onClick={() => setValue(deviceZone)}
        >
          Use this device&apos;s: {deviceZone}
        </Button>
      )}
      <Text size="1" color="gray">
        Decides where “Today” falls on the home feed.
      </Text>
    </Flex>
  );
}
