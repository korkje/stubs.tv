import Link from "next/link";
import { Callout, Container, Link as RadixLink } from "@radix-ui/themes";

/** Shown across /app while plan = 'free' — the account can look, not touch. */
export function ReadOnlyBanner() {
  return (
    // flexGrow 0: Container defaults to flex-grow 1, and inside the /app
    // layout's full-height column that made the banner absorb half the
    // viewport — centering the page below it, and reflowing visibly in
    // Chrome as streamed content arrived.
    <Container size="3" px="4" pt="5" flexGrow="0">
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
