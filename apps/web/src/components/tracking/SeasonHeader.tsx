"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { ChevronDownIcon, ChevronRightIcon } from "@radix-ui/react-icons";
import { Flex, Heading, Reset, Spinner, Text } from "@radix-ui/themes";

/**
 * Expands or collapses one season. The open set lives in the URL and the
 * episodes render on the server (only open seasons are fetched — the CPU
 * budget rules out rendering them all), so a toggle is a navigation: the
 * chevron becomes a spinner while it is in flight, which is the honest
 * version of an instant accordion.
 */
export function SeasonHeader({
  href,
  open,
  title,
  subtitle,
}: {
  href: string;
  open: boolean;
  title: string;
  subtitle: string;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  return (
    <Reset>
      <button
        aria-expanded={open}
        onClick={() => {
          startTransition(() => router.push(href, { scroll: false }));
        }}
      >
        <Flex align="center" gap="2">
          {isPending ? (
            <Spinner size="1" />
          ) : open ? (
            <ChevronDownIcon />
          ) : (
            <ChevronRightIcon />
          )}
          <Heading size="4">{title}</Heading>
          <Text size="2" color="gray">
            {subtitle}
          </Text>
        </Flex>
      </button>
    </Reset>
  );
}
