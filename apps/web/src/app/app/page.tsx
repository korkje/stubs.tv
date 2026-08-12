import { Container, Heading, VisuallyHidden } from "@radix-ui/themes";
import { createClient } from "@/lib/supabase/server";
import { fetchUpNext } from "@/lib/up-next/actions";
import { UpNextFeed } from "@/components/up-next/UpNextFeed";

/**
 * Home: unwatched episodes of followed shows, in release order, centered on
 * today — the past scrolls up, the future scrolls down. The heavy lifting
 * (bidirectional infinite scroll, the focus lens) lives in the client feed;
 * this page just seeds the first window on the server.
 *
 * "Today" is the calendar date in the user's chosen timezone (settings),
 * falling back to UTC until one is picked.
 */
export default async function HomePage() {
  const supabase = await createClient();
  const { data: profile } = await supabase
    .from("profiles")
    .select("timezone, synopsis_mode")
    .maybeSingle();

  // en-CA formats as YYYY-MM-DD, matching the aired column.
  const today = new Intl.DateTimeFormat("en-CA", {
    timeZone: profile?.timezone ?? "UTC",
  }).format(new Date());

  const [past, future] = await Promise.all([
    fetchUpNext(true, today, 0),
    fetchUpNext(false, today, 0),
  ]);

  return (
    <Container size="3" px="4">
      <VisuallyHidden>
        <Heading as="h1">Up next</Heading>
      </VisuallyHidden>
      <UpNextFeed
        today={today}
        initialPast={past}
        initialFuture={future}
        synopsisMode={profile?.synopsis_mode ?? "show"}
      />
    </Container>
  );
}
