import Link from "next/link";
import { Callout, Container, Link as RadixLink } from "@radix-ui/themes";

/** Shown across /app while plan = 'free' — the account can look, not touch. */
export function ReadOnlyBanner() {
  return (
    <Container size="3" px="4" pt="5">
      <Callout.Root color="amber">
        <Callout.Text>
          Your account is read-only.{" "}
          <RadixLink asChild>
            <Link href="/app/plans">Choose a plan</Link>
          </RadixLink>{" "}
          to start tracking — the annual plan&apos;s first month is free.
        </Callout.Text>
      </Callout.Root>
    </Container>
  );
}
