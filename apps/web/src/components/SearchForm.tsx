"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { Box, Button, Flex } from "@radix-ui/themes";
import { SearchField } from "./SearchField";

/**
 * The search form, submitted as a client-side navigation so the button can
 * show a pending spinner — a native GET form reloads the whole page and
 * leaves the user staring at a frozen UI while the provider responds.
 */
export function SearchForm({ defaultValue }: { defaultValue: string }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  return (
    <form
      onSubmit={(event) => {
        event.preventDefault();
        const q = ((new FormData(event.currentTarget).get("q") as string) ?? "").trim();
        startTransition(() => {
          router.push(q ? `/app/search?q=${encodeURIComponent(q)}` : "/app/search");
        });
      }}
    >
      <Flex gap="3" align="center">
        <Box flexGrow="1" style={{ minWidth: 0 }}>
          <SearchField defaultValue={defaultValue} />
        </Box>
        <Button size="3" type="submit" loading={isPending}>
          Search
        </Button>
      </Flex>
    </form>
  );
}
