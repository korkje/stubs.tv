"use client";

import { useEffect, useRef, useState } from "react";
import { Box, Reset, Text } from "@radix-ui/themes";

/**
 * A detail page's synopsis. On phones it clamps to a few lines (the
 * .clamp-overview rule in globals.css) behind a Show more toggle; wider
 * screens always show the full text. The toggle only appears once the
 * paragraph measures as actually truncated, so short overviews and wide
 * screens never see it, and the ResizeObserver keeps that honest across
 * rotations and window resizing.
 */
export function Overview({ text }: { text: string }) {
  const ref = useRef<HTMLParagraphElement>(null);
  const [expanded, setExpanded] = useState(false);
  const [clamped, setClamped] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const measure = () => setClamped(el.scrollHeight > el.clientHeight + 1);
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  return (
    <Box>
      <Text
        as="p"
        size="3"
        ref={ref}
        className={expanded ? undefined : "clamp-overview"}
        style={{ lineHeight: 1.6 }}
      >
        {text}
      </Text>
      {(clamped || expanded) && (
        <Reset>
          <button onClick={() => setExpanded((value) => !value)}>
            <Text size="2" color="amber" weight="medium">
              {expanded ? "Show less" : "Show more"}
            </Text>
          </button>
        </Reset>
      )}
    </Box>
  );
}
