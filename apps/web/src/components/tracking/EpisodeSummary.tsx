"use client";

import { useState } from "react";
import { Text } from "@radix-ui/themes";

/**
 * An episode synopsis, clamped to two lines until clicked.
 *
 * A button rather than a clickable div so it can be reached from the keyboard;
 * it inherits the surrounding text styling so it still reads as prose.
 */
export function EpisodeSummary({ overview }: { overview: string }) {
  const [expanded, setExpanded] = useState(false);

  return (
    <Text
      asChild
      size="1"
      color="gray"
      mt="1"
      className={expanded ? undefined : "clamp-2-lines"}
    >
      <button
        type="button"
        aria-expanded={expanded}
        onClick={() => setExpanded((open) => !open)}
        style={{
          display: expanded ? "block" : "-webkit-box",
          background: "none",
          border: 0,
          padding: 0,
          margin: 0,
          font: "inherit",
          color: "inherit",
          textAlign: "left",
          cursor: "pointer",
        }}
      >
        {overview}
      </button>
    </Text>
  );
}
