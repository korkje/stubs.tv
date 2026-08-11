import Link from "next/link";
import { Badge, Button, Card, Flex, Text } from "@radix-ui/themes";
import { createClient } from "@/lib/supabase/server";
import { FollowStar } from "@/components/tracking/FollowStar";
import { AnimatedRows } from "./AnimatedRows";
import { LibraryRow } from "./LibraryRow";

/**
 * Every show the user follows or has watched episodes of, with how much is
 * left to watch. Each row carries the follow star, which doubles as the
 * toggle. Unfollowing a show with no watches drops it from the list on the
 * next render — membership requires a follow or watched episodes.
 */
export async function ShowsList() {
  const supabase = await createClient();

  // series_progress is a security_invoker view, so this returns only the
  // signed-in user's shows.
  const { data: shows } = await supabase
    .from("series_progress")
    .select("*")
    .order("name");

  if (!shows || shows.length === 0) {
    return (
      <Card>
        <Flex direction="column" align="start" gap="3" p="2">
          <Text color="gray">
            Nothing here yet. Find a show and follow it or mark episodes as
            seen, and it will show up here.
          </Text>
          <Button asChild>
            <Link href="/app/search">Search shows</Link>
          </Button>
        </Flex>
      </Card>
    );
  }

  return (
    <Flex direction="column">
      <AnimatedRows>
      {shows.map((show) => {
        const aired = show.aired_episodes ?? 0;
        const watched = show.watched_episodes ?? 0;
        // Watched can exceed aired when specials are marked, since progress
        // counts only aired, non-special episodes.
        const unseen = Math.max(aired - watched, 0);

        return (
          <LibraryRow
            key={show.series_id}
            href={`/app/series/${show.series_id}`}
            name={show.name ?? "Untitled"}
            posterUrl={show.poster_url}
            date={show.first_aired}
            runtimeMin={show.runtime_min}
            rating={show.rating}
            overview={show.overview}
            titleIcon={
              show.series_id != null ? (
                <FollowStar
                  seriesId={show.series_id}
                  following={show.followed ?? false}
                  revalidate="/app"
                />
              ) : null
            }
            badge={
              unseen > 0 ? (
                <Badge size="1" color="amber" variant="soft">
                  {unseen} to watch
                </Badge>
              ) : aired > 0 ? (
                <Badge size="1" color="gray" variant="soft">
                  Up to date
                </Badge>
              ) : null
            }
          />
        );
      })}
      </AnimatedRows>
    </Flex>
  );
}
