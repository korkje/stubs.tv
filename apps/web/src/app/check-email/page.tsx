import Link from "next/link";
import { Button, Card, Container, Flex, Heading, Text } from "@radix-ui/themes";

export default function CheckEmailPage() {
  return (
    <Container size="1" px="4">
      <Flex direction="column" gap="4" py="9">
        <Heading size="6">Check your email</Heading>
        <Card>
          <Flex direction="column" gap="3">
            <Text>
              We sent you a verification link. Click it to activate your
              account — it signs you in automatically.
            </Text>
            <Text size="2" color="gray">
              Nothing arriving? Check spam, or try signing up again to resend
              the link.
            </Text>
            <Flex>
              <Button variant="soft" asChild>
                <Link href="/login">Back to sign in</Link>
              </Button>
            </Flex>
          </Flex>
        </Card>
      </Flex>
    </Container>
  );
}
