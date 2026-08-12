import { Container, Heading, VisuallyHidden } from "@radix-ui/themes";
import { fetchUpNext } from "@/lib/up-next/actions";
import { UpNextFeed } from "@/components/up-next/UpNextFeed";

/**
 * Home: unwatched episodes of followed shows, in release order, centered on
 * today — the past scrolls up, the future scrolls down. The heavy lifting
 * (bidirectional infinite scroll, the focus lens) lives in the client feed;
 * this page just seeds the first window on the server.
 *
 * "Today" is the UTC date on purpose: between midnight and small-hours local
 * time the marker may sit on what feels like yesterday, which is a fair
 * trade against carrying a timezone preference this early.
 */
export default async function HomePage() {
  const today = new Date().toISOString().slice(0, 10);

  const [past, future] = await Promise.all([
    fetchUpNext(true, today, 0),
    fetchUpNext(false, today, 0),
  ]);

  return (
    <Container size="3" px="4">
      <VisuallyHidden>
        <Heading as="h1">Up next</Heading>
      </VisuallyHidden>
      <UpNextFeed today={today} initialPast={past} initialFuture={future} />
    </Container>
  );
}
