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
  TextField,
} from "@radix-ui/themes";
import { AuthEmailField } from "@/components/auth/AuthEmailField";
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
        <Heading size="6">Create your stubs.tv account</Heading>

        {error && (
          <Callout.Root color="red">
            <Callout.Text>{error}</Callout.Text>
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
                {/* Shared with the other auth pages so a typed address
                    survives hopping between them. */}
                <AuthEmailField />
              </label>
              <label>
                <Text as="div" size="2" mb="1" weight="medium">
                  Password
                </Text>
                <TextField.Root
                  name="password"
                  type="password"
                  autoComplete="new-password"
                  size="3"
                  required
                />
              </label>
              <Flex mt="2">
                <Button formAction={signup}>Create account</Button>
              </Flex>
            </Flex>
          </form>
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
