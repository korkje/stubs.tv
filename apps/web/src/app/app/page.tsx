import { redirect } from "next/navigation";
import { Button, Container, Flex, Heading, Text } from "@radix-ui/themes";
import { createClient } from "@/lib/supabase/server";
import { signout } from "@/app/login/actions";

export default async function AppHome() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  return (
    <Container size="3" px="4">
      <Flex direction="column" gap="4" py="6">
        <Flex justify="between" align="center">
          <Heading size="6">Your stubs</Heading>
          <form action={signout}>
            <Button variant="soft" color="gray">
              Sign out
            </Button>
          </form>
        </Flex>
        <Text color="gray">
          Signed in as {user.email}. Tracking starts in Phase 1.
        </Text>
      </Flex>
    </Container>
  );
}
