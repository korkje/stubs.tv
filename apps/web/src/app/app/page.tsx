import Link from "next/link";
import { redirect } from "next/navigation";
import { Button, Card, Container, Flex, Heading, Text } from "@radix-ui/themes";
import { createClient } from "@/lib/supabase/server";

export default async function AppHome() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  return (
    <Container size="4" px="4">
      <Flex direction="column" gap="4">
        <Heading size="6">My shows</Heading>
        <Card>
          <Flex direction="column" align="start" gap="3" p="2">
            <Text color="gray">
              Nothing tracked yet. Find a film or TV show to get started —
              following and marking things as seen arrives next.
            </Text>
            <Button asChild>
              <Link href="/app/search">Search titles</Link>
            </Button>
          </Flex>
        </Card>
      </Flex>
    </Container>
  );
}
