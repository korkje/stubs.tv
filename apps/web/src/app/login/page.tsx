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
import { AuthEmailField } from "@/components/auth/AuthEmailField";
import { PasswordField } from "@/components/auth/PasswordField";
import { safeNext } from "@/lib/redirects";
import { createClient } from "@/lib/supabase/server";
import { login } from "./actions";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; next?: string; deleted?: string }>;
}) {
  const params = await searchParams;
  const error = params.error;
  const deleted = params.deleted === "1";
  const next = safeNext(params.next);

  // Already signed in? The form would be a dead end — carry on to wherever
  // the visitor was headed.
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (user) redirect(next ?? "/app");

  return (
    <Container size="1" px="4">
      <Flex direction="column" gap="4" py="9">
        <Heading size="6">Sign in to stubs.tv</Heading>

        {error && (
          <Callout.Root color="red">
            <Callout.Text>{error}</Callout.Text>
          </Callout.Root>
        )}

        {deleted && (
          <Callout.Root color="green">
            <Callout.Text>
              Your account and all its data have been deleted. Thanks for
              giving stubs.tv a try.
            </Callout.Text>
          </Callout.Root>
        )}

        <Card>
          <form>
            {next && <input type="hidden" name="next" value={next} />}
            <Flex direction="column" gap="3">
              <label>
                <Text as="div" size="2" mb="1" weight="medium">
                  Email
                </Text>
                {/* Shared with signup/forgot-password so a typed address
                    survives hopping between them. */}
                <AuthEmailField />
              </label>
              <label>
                <Text as="div" size="2" mb="1" weight="medium">
                  Password
                </Text>
                <PasswordField autoComplete="current-password" />
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
            <Link href={next ? `/signup?next=${encodeURIComponent(next)}` : "/signup"}>
              Create an account
            </Link>
          </RadixLink>
        </Text>
      </Flex>
    </Container>
  );
}
