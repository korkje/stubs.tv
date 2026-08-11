import Link from "next/link";
import { Badge, Button, Card, Flex, Text } from "@radix-ui/themes";
import { createClient } from "@/lib/supabase/server";
import { Poster } from "@/components/Poster";

/** Followed shows with how much is left to watch. */
export async function ShowsList() {
  const supabase = await createClient();

  // series_progress is a security_invoker view, so this returns only the
  // signed-in user's followed shows.
  const { data: shows } = await supabase
    .from("series_progress")
    .select("*")
    .order("name");

  if (!shows || shows.length === 0) {
    return (
      <Card>
        <Flex direction="column" align="start" gap="3" p="2">
          <Text color="gray">
            You are not following any shows yet. Find one and hit Follow to see
            your progress here.
          </Text>
          <Button asChild>
            <Link href="/app/search">Search shows</Link>
          </Button>
        </Flex>
      </Card>
    );
  }

  return (
    <Flex direction="column" gap="3">
      {shows.map((show) => {
        const aired = show.aired_episodes ?? 0;
        const watched = show.watched_episodes ?? 0;
        // Watched can exceed aired when specials are marked, since progress
        // counts only aired, non-special episodes.
        const unseen = Math.max(aired - watched, 0);

        return (
          <Card key={show.series_id} asChild>
            <Link href={`/app/series/${show.series_id}`}>
              <Flex gap="4" align="center">
                <Poster url={show.poster_url} alt={show.name ?? ""} width={56} />
                <Flex direction="column" gap="1">
                  <Text weight="bold" size="3">
                    {show.name}
                  </Text>
                  {/* Stacks on a phone, sits inline from sm up. align="start"
                      is what stops the badge stretching to the full width: a
                      column flex stretches its children by default. */}
                  <Flex
                    direction={{ initial: "column", sm: "row" }}
                    align={{ initial: "start", sm: "center" }}
                    gap={{ initial: "1", sm: "2" }}
                  >
                    <Text size="2" color="gray">
                      {watched} of {aired} aired episodes seen
                    </Text>
                    {unseen > 0 ? (
                      <Badge color="amber" variant="soft">
                        {unseen} to watch
                      </Badge>
                    ) : (
                      aired > 0 && (
                        <Badge color="gray" variant="soft">
                          Up to date
                        </Badge>
                      )
                    )}
                  </Flex>
                </Flex>
              </Flex>
            </Link>
          </Card>
        );
      })}
    </Flex>
  );
}
