import Link from "next/link";
import { redirect } from "next/navigation";
import {
  Button,
  Callout,
  Card,
  Container,
  Flex,
  Heading,
  Text,
  Link as RadixLink,
} from "@radix-ui/themes";
import { TextField } from "@radix-ui/themes";
import { login } from "./actions";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; invite?: string }>;
}) {
  const { error, invite } = await searchParams;

  // Old invite links pointed here; the signup page is where they belong.
  if (invite) redirect(`/signup?invite=${encodeURIComponent(invite)}`);

  return (
    <Container size="1" px="4">
      <Flex direction="column" gap="4" py="9">
        <Heading size="6">Sign in to stubs.tv</Heading>

        {error && (
          <Callout.Root color="red">
            <Callout.Text>{error}</Callout.Text>
          </Callout.Root>
        )}

        <Card>
          <form>
            <Flex direction="column" gap="3">
              <label>
                <Text as="div" size="2" mb="1" weight="medium">
                  Email
                </Text>
                {/* size 3 is 16px: anything smaller makes iOS Safari zoom
                    in when the field is focused. */}
                <TextField.Root
                  name="email"
                  type="email"
                  autoComplete="email"
                  size="3"
                  required
                />
              </label>
              <label>
                <Text as="div" size="2" mb="1" weight="medium">
                  Password
                </Text>
                <TextField.Root
                  name="password"
                  type="password"
                  autoComplete="current-password"
                  size="3"
                  required
                />
              </label>
              <Flex mt="2">
                <Button formAction={login}>Sign in</Button>
              </Flex>
            </Flex>
          </form>
        </Card>

        <Text size="2" color="gray">
          <RadixLink asChild>
            <Link href="/forgot-password">Forgot your password?</Link>
          </RadixLink>
        </Text>

        <Text size="2" color="gray">
          New here?{" "}
          <RadixLink asChild>
            <Link href="/signup">Create an account</Link>
          </RadixLink>
        </Text>
      </Flex>
    </Container>
  );
}
