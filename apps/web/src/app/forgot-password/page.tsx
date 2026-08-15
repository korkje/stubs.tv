import Link from "next/link";
import {
  Button,
  Card,
  Container,
  Flex,
  Heading,
  Text,
  TextField,
  Link as RadixLink,
} from "@radix-ui/themes";
import { requestPasswordReset } from "./actions";

export default function ForgotPasswordPage() {
  return (
    <Container size="1" px="4">
      <Flex direction="column" gap="4" py="9">
        <Heading size="6">Reset your password</Heading>

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
