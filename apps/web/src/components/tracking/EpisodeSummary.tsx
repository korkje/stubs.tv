"use client";

import { useState } from "react";
import { Text } from "@radix-ui/themes";

/**
 * An episode synopsis, clamped to two lines until clicked.
 *
 * A button rather than a clickable div so it can be reached from the keyboard;
 * it inherits the surrounding font family so it still reads as prose — but
 * only the family: an inline `font: inherit` shorthand also inherited the
 * page's 16px size, overriding the size-1 class Text merges onto the button
 * and rendering every synopsis bigger than the episode name above it.
 *
 * The clamp lives on an inner span, not on the button: line-clamp has no
 * effect applied to a form control itself, so Safari rendered every synopsis
 * in full. Chrome happened to accept it, which is why this only showed up on
 * one browser.
 */
export function EpisodeSummary({ overview }: { overview: string }) {
  const [expanded, setExpanded] = useState(false);

  return (
    <Text asChild size="1" color="gray" mt="1">
      <button
        type="button"
        aria-expanded={expanded}
        onClick={() => setExpanded((open) => !open)}
        style={{
          display: "block",
          width: "100%",
          background: "none",
          border: 0,
          padding: 0,
          margin: 0,
          fontFamily: "inherit",
          textAlign: "left",
          cursor: "pointer",
        }}
      >
        <span className={expanded ? undefined : "clamp-2-lines"}>{overview}</span>
      </button>
    </Text>
  );
}
