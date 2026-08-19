"use client";

import { useState } from "react";
import { Button, Flex, TextField } from "@radix-ui/themes";

/**
 * A read-only URL with a copy button — for the calendar feed URL, where
 * "select it all inside a tiny input" is exactly the fiddle a button avoids.
 * Falls back to selecting the text when the Clipboard API is unavailable
 * (non-secure contexts), so the user can copy manually.
 */
export function CopyUrlField({ url }: { url: string }) {
  const [copied, setCopied] = useState(false);

  return (
    <Flex gap="2" width="100%">
      <TextField.Root
        value={url}
        readOnly
        size="2"
        style={{ flexGrow: 1, minWidth: 0 }}
        onFocus={(event) => event.currentTarget.select()}
      />
      <Button
        type="button"
        variant="soft"
        onClick={async () => {
          try {
            await navigator.clipboard.writeText(url);
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
          } catch {
            // Clipboard blocked — leave the field selected instead.
          }
        }}
      >
        {copied ? "Copied" : "Copy"}
      </Button>
    </Flex>
  );
}
