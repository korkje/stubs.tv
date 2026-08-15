import Link from "next/link";
import {
  Button,
  Card,
  Container,
  Flex,
  Heading,
  Text,
  Link as RadixLink,
} from "@radix-ui/themes";

/**
 * Shared "we sent you something" page. Signup lands here after the
 * confirmation mail; the reset flow passes ?flow=reset so the copy describes
 * the link the user is actually waiting for.
 */
export default async function CheckEmailPage({
  searchParams,
}: {
  searchParams: Promise<{ flow?: string }>;
}) {
  const { flow } = await searchParams;
  const reset = flow === "reset";

  return (
    <Container size="1" px="4">
      <Flex direction="column" gap="4" py="9">
        <Heading size="6">Check your email</Heading>
        <Card>
          <Flex direction="column" gap="3">
            <Text>
              {reset
                ? "If that address has an account, we just sent it a link to set a new password."
                : "We sent you a verification link. Click it to activate your account — it signs you in automatically."}
            </Text>
            <Text size="2" color="gray">
              {reset
                ? "Nothing arriving? Check spam, or request another link."
                : "Nothing arriving? Check spam, or try signing up again to resend the link."}
            </Text>
            <Flex>
              <Button variant="soft" asChild>
                <Link href="/login">Back to sign in</Link>
              </Button>
            </Flex>
          </Flex>
        </Card>

        {reset && (
          <Text size="2" color="gray">
            Still nothing?{" "}
            <RadixLink asChild>
              <Link href="/forgot-password">Request another link</Link>
            </RadixLink>
          </Text>
        )}
      </Flex>
    </Container>
  );
}
