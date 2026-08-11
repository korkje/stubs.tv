"use client";

import { useState } from "react";
import { IconButton } from "@radix-ui/themes";
import { CheckIcon, CopyIcon } from "@radix-ui/react-icons";

/**
 * Copies the invite's signup link. The URL is built in the browser from the
 * page origin, so it is right in every environment without configuration.
 */
export function CopyInviteLink({ code }: { code: string }) {
  const [copied, setCopied] = useState(false);

  return (
    <IconButton
      size="1"
      variant="ghost"
      color={copied ? "green" : "gray"}
      aria-label="Copy invite link"
      onClick={async () => {
        const url = `${window.location.origin}/signup?invite=${code}`;
        await navigator.clipboard.writeText(url);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      }}
    >
      {copied ? <CheckIcon /> : <CopyIcon />}
    </IconButton>
  );
}
