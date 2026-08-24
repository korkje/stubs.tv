import Link from "next/link";
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
import { OAuthButtons } from "@/components/auth/OAuthButtons";
import { PasswordField } from "@/components/auth/PasswordField";
import { enabledProviders } from "@/lib/auth/providers";
import { signout } from "@/app/login/actions";
import { safeNext } from "@/lib/redirects";
import { createClient } from "@/lib/supabase/server";
import { signup } from "./actions";

export default async function SignupPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; next?: string }>;
}) {
  const params = await searchParams;
  const error = params.error;
  const next = safeNext(params.next);

  // Already signed in? Unlike /login (where continuing silently is what a
  // returning visitor wants), silently entering the app here reads as
  // "account created" when nothing happened. Say what's true and offer the
  // two honest ways forward.
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (user) {
    return (
      <Container size="1" px="4">
        <Flex direction="column" gap="4" py="9">
          <Heading size="6">You already have an account</Heading>
          <Text size="3" color="gray">
            You&apos;re signed in as <strong>{user.email}</strong>. To create
            a separate account, sign out first.
          </Text>
          <Flex gap="3">
            <Button size="3" asChild>
              <Link href={next ?? "/app"}>Continue to the app</Link>
            </Button>
            <form action={signout}>
              <Button size="3" variant="soft" type="submit">
                Sign out
              </Button>
            </form>
          </Flex>
        </Flex>
      </Container>
    );
  }

  return (
    <Container size="1" px="4">
      <Flex direction="column" gap="4" py="9">
        <Heading size="6">Create your stubs.tv account</Heading>

        {error && (
          <Callout.Root color="red">
            <Callout.Text>{error}</Callout.Text>
          </Callout.Root>
        )}

        <Card>
          <Flex direction="column" gap="3">
            {/* One tap, no verification email — the preferred door. */}
            <OAuthButtons providers={enabledProviders()} next={next} />
            <form>
              {next && <input type="hidden" name="next" value={next} />}
              <Flex direction="column" gap="3">
                <label>
                  <Text as="div" size="2" mb="1" weight="medium">
                    Email
                  </Text>
                  {/* Shared with the other auth pages so a typed address
                      survives hopping between them. */}
                  <AuthEmailField />
                </label>
                <label>
                  <Text as="div" size="2" mb="1" weight="medium">
                    Password
                  </Text>
                  <PasswordField autoComplete="new-password" />
                </label>
                <Flex mt="2">
                  <Button formAction={signup}>Create account</Button>
                </Flex>
              </Flex>
            </form>
          </Flex>
        </Card>

        <Text size="2" color="gray">
          Accounts start read-only — pick a plan to start tracking. The annual
          plan&apos;s first month is free.
        </Text>

        <Text size="2" color="gray">
          Already have an account?{" "}
          <RadixLink asChild>
            <Link href={next ? `/login?next=${encodeURIComponent(next)}` : "/login"}>
              Sign in
            </Link>
          </RadixLink>
        </Text>
      </Flex>
    </Container>
  );
}
