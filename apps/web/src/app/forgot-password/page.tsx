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
import { Turnstile } from "@/components/auth/Turnstile";
import { CAPTCHA_FAILED, turnstileSiteKey } from "@/lib/auth/captcha";
import { requestPasswordReset } from "./actions";

export default async function ForgotPasswordPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  // Reading the request keeps this page dynamic, so the Turnstile site key
  // is read at request time rather than baked in at build time.
  const { error } = await searchParams;

  return (
    <Container size="1" px="4">
      <Flex direction="column" gap="4" py="9">
        <Heading size="6">Reset your password</Heading>

        {/* A code, not text: nothing from the URL is shown. */}
        {error === "captcha" && (
          <Callout.Root color="red">
            <Callout.Text>{CAPTCHA_FAILED}</Callout.Text>
          </Callout.Root>
        )}

        <Card>
          <form action={requestPasswordReset}>
            <Flex direction="column" gap="3">
              <Text size="2" color="gray">
                Enter the address you signed up with and we will send you a
                link to set a new password.
              </Text>
              <label>
                <Text as="div" size="2" mb="1" weight="medium">
                  Email
                </Text>
                {/* Shared with the other auth pages so a typed address
                    survives hopping between them. */}
                <AuthEmailField />
              </label>
              <Turnstile siteKey={turnstileSiteKey()} />
              <Flex mt="2">
                <Button type="submit">Send reset link</Button>
              </Flex>
            </Flex>
          </form>
        </Card>

        <Text size="2" color="gray">
          Remembered it?{" "}
          <RadixLink asChild>
            <Link href="/login">Back to sign in</Link>
          </RadixLink>
        </Text>
      </Flex>
    </Container>
  );
}
