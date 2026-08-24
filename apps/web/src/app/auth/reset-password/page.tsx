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
import { PasswordField } from "@/components/auth/PasswordField";
import { resetPassword } from "./actions";

export default async function ResetPasswordPage({
  searchParams,
}: {
  searchParams: Promise<{ token_hash?: string; error?: string }>;
}) {
  const { token_hash, error } = await searchParams;

  // Without a token there is nothing this page can do — and no form to offer,
  // since the action refuses anything else. An error with no token is the
  // spent-token case, which still has something to say.
  if (!token_hash && !error) {
    redirect("/forgot-password");
  }

  return (
    <Container size="1" px="4">
      <Flex direction="column" gap="4" py="9">
        <Heading size="6">Choose a new password</Heading>

        {error && (
          <Callout.Root color="red">
            <Callout.Text>{error}</Callout.Text>
          </Callout.Root>
        )}

        {/* No token, no form: the action would only reject it, and offering
            one invites the belief that a spent link can be retried. */}
        {token_hash && (
          <Card>
            <form action={resetPassword}>
              <Flex direction="column" gap="3">
                {/* The link carries the token; spending it is the action's job. */}
                <input type="hidden" name="token_hash" value={token_hash} />
                <label>
                  <Text as="div" size="2" mb="1" weight="medium">
                    New password
                  </Text>
                  <PasswordField autoComplete="new-password" />
                </label>
                <Flex mt="2">
                  <Button type="submit">Set password</Button>
                </Flex>
              </Flex>
            </form>
          </Card>
        )}

        <Text size="2" color="gray">
          Link expired?{" "}
          <RadixLink asChild>
            <Link href="/forgot-password">Send a new one</Link>
          </RadixLink>
        </Text>
      </Flex>
    </Container>
  );
}
