import { Container, Heading, VisuallyHidden } from "@radix-ui/themes";
import { createClient } from "@/lib/supabase/server";
import { fetchUpNext } from "@/lib/up-next/actions";
import { FEED_FACETS, parseFilters, restrict, serializeFilters } from "@/lib/filters";
import { FEED_SEED } from "@/lib/paging";
import { FeedConfigButton } from "@/components/filters/FeedConfigButton";
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
export default async function HomePage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  // Restricted to the facets this surface has: a link carrying the library's
  // filters should not quietly narrow the feed by something it never offered
  // a way to turn off.
  const filters = restrict(parseFilters(await searchParams), FEED_FACETS);

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
    fetchUpNext(true, today, 0, FEED_SEED, filters),
    fetchUpNext(false, today, 0, FEED_SEED, filters),
  ]);

  return (
    <Container size="3" px="4">
      <VisuallyHidden>
        <Heading as="h1">Up next</Heading>
      </VisuallyHidden>
      {/* Keyed on the filters. The feed seeds its rows into state at mount,
          so without this the toggle's fresh seed pages would be ignored by
          the instance already on screen. Remounting also replays the
          scroll-to-Today and the entrance stagger — which was tried the
          other way (morphing the rows in place with the Today line pinned)
          and reverted: holding the scroll still while heights animate above
          the viewport takes three layers of scroll diplomacy against the
          router and the browser's own anchoring, and the result still felt
          like a trick. A fresh entrance at Today is the honest version. */}
      <UpNextFeed
        key={serializeFilters(filters).toString()}
        today={today}
        initialPast={past}
        initialFuture={future}
        synopsisMode={profile?.synopsis_mode ?? "show"}
        filters={filters}
      />
      <FeedConfigButton filters={filters} />
    </Container>
  );
}
