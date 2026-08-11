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
  TextField,
} from "@radix-ui/themes";
import { createClient } from "@/lib/supabase/server";
import { signup } from "./actions";

export default async function SignupPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; invite?: string }>;
}) {
  const { error, invite } = await searchParams;

  // While signups are invite-only the form carries an invite code field —
  // prefilled when the visitor arrived through an invite link.
  const supabase = await createClient();
  const { data: settings } = await supabase
    .from("app_settings")
    .select("open_signups")
    .maybeSingle();
  const inviteOnly = !settings?.open_signups;

  return (
    <Container size="1" px="4">
      <Flex direction="column" gap="4" py="9">
        <Heading size="6">Create your stubs.tv account</Heading>

        {inviteOnly && !invite && !error && (
          <Callout.Root color="amber">
            <Callout.Text>
              Signups are invite-only right now — you need an invite code from
              a member to join.
            </Callout.Text>
          </Callout.Root>
        )}

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
                  autoComplete="new-password"
                  size="3"
                  required
                />
              </label>
              {inviteOnly && (
                <label>
                  <Text as="div" size="2" mb="1" weight="medium">
                    Invite code
                  </Text>
                  <TextField.Root
                    name="invite"
                    defaultValue={invite ?? ""}
                    autoComplete="off"
                    size="3"
                    required
                  />
                </label>
              )}
              <Flex mt="2">
                <Button formAction={signup}>Create account</Button>
              </Flex>
            </Flex>
          </form>
        </Card>

        <Text size="2" color="gray">
          Already have an account?{" "}
          <RadixLink asChild>
            <Link href="/login">Sign in</Link>
          </RadixLink>
        </Text>
      </Flex>
    </Container>
  );
}
