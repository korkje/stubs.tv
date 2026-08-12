"use client";

import { useState } from "react";
import { Flex, Link, Select, Text } from "@radix-ui/themes";

/**
 * A curated list beats the full IANA registry (400+ rows): one recognisable
 * city per populated offset, which is what time zone pickers usually offer.
 * The device's zone and any previously saved zone are merged in, so nobody's
 * choice ever disappears from the menu.
 */
const COMMON_ZONES = [
  "Europe/London",
  "Europe/Dublin",
  "Europe/Lisbon",
  "Europe/Paris",
  "Europe/Berlin",
  "Europe/Amsterdam",
  "Europe/Brussels",
  "Europe/Madrid",
  "Europe/Rome",
  "Europe/Zurich",
  "Europe/Copenhagen",
  "Europe/Oslo",
  "Europe/Stockholm",
  "Europe/Helsinki",
  "Europe/Warsaw",
  "Europe/Prague",
  "Europe/Vienna",
  "Europe/Athens",
  "Europe/Bucharest",
  "Europe/Kyiv",
  "Europe/Istanbul",
  "Europe/Moscow",
  "America/New_York",
  "America/Toronto",
  "America/Chicago",
  "America/Mexico_City",
  "America/Denver",
  "America/Los_Angeles",
  "America/Vancouver",
  "America/Anchorage",
  "Pacific/Honolulu",
  "America/Bogota",
  "America/Lima",
  "America/Santiago",
  "America/Sao_Paulo",
  "America/Argentina/Buenos_Aires",
  "Africa/Cairo",
  "Africa/Lagos",
  "Africa/Johannesburg",
  "Africa/Nairobi",
  "Asia/Dubai",
  "Asia/Tehran",
  "Asia/Karachi",
  "Asia/Kolkata",
  "Asia/Dhaka",
  "Asia/Bangkok",
  "Asia/Jakarta",
  "Asia/Singapore",
  "Asia/Shanghai",
  "Asia/Hong_Kong",
  "Asia/Taipei",
  "Asia/Seoul",
  "Asia/Tokyo",
  "Australia/Perth",
  "Australia/Adelaide",
  "Australia/Brisbane",
  "Australia/Sydney",
  "Pacific/Auckland",
];

/**
 * Time zone picker. The value rides in a hidden input so the surrounding
 * plain form can submit it.
 */
export function TimezoneField({ initial }: { initial: string }) {
  const [value, setValue] = useState(initial || "UTC");
  const deviceZone = Intl.DateTimeFormat().resolvedOptions().timeZone;

  const zones = [
    ...new Set(["UTC", deviceZone, initial, ...COMMON_ZONES].filter(Boolean)),
  ];

  return (
    <Flex direction="column" gap="2" align="start">
      <input type="hidden" name="timezone" value={value === "UTC" ? "" : value} />
      <Select.Root value={value} onValueChange={setValue}>
        <Select.Trigger />
        <Select.Content position="popper">
          {zones.map((zone) => (
            <Select.Item key={zone} value={zone}>
              {zone}
            </Select.Item>
          ))}
        </Select.Content>
      </Select.Root>
      {deviceZone && value !== deviceZone && (
        <Link asChild size="1" underline="always">
          <button
            type="button"
            onClick={() => setValue(deviceZone)}
            style={{
              background: "none",
              border: 0,
              padding: 0,
              font: "inherit",
              cursor: "pointer",
            }}
          >
            Use this device&apos;s: {deviceZone}
          </button>
        </Link>
      )}
      <Text size="1" color="gray">
        Decides where “Today” falls on the home feed.
      </Text>
    </Flex>
  );
}
