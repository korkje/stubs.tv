import Link from "next/link";
import {
  Button,
  Card,
  Container,
  Flex,
  Heading,
  Text,
} from "@radix-ui/themes";
import { confirmLinkType, type ConfirmLinkType } from "@/lib/auth/email-links";
import { safeNext } from "@/lib/redirects";
import { createClient } from "@/lib/supabase/server";
import { confirmEmailLink } from "./actions";

const COPY: Record<
  ConfirmLinkType,
  { heading: string; body: string; button: string }
> = {
  email: {
    heading: "Confirm your email",
    body: "One click confirms your address and signs you in.",
    button: "Confirm and sign in",
  },
  magiclink: {
    heading: "Sign in to stubs.tv",
    body: "This link signs you in on this device.",
    button: "Sign in",
  },
  email_change: {
    heading: "Confirm the email change",
    body: "Confirm to move your account to its new email address.",
    button: "Confirm",
  },
};

/**
 * Where every confirmation, magic-link and email-change mail lands
 * (supabase/templates). The page only offers a button: confirmEmailLink
 * spends the token on submit, never this GET (ADR-0023), so a mail scanner
 * that prefetches the link can't burn it, and no other site can sign a
 * visitor into an account without a click here.
 */
export default async function ConfirmPage({
  searchParams,
}: {
  searchParams: Promise<{ token_hash?: string; type?: string; next?: string }>;
}) {
  const params = await searchParams;
  const tokenHash = params.token_hash?.trim() ?? "";
  const type = confirmLinkType(params.type);
  const next = safeNext(params.next);

  if (!tokenHash || !type) {
    return (
      <Container size="1" px="4">
        <Flex direction="column" gap="4" py="9">
          <Heading size="6">This link doesn&apos;t work</Heading>
          <Text size="3" color="gray">
            It is incomplete, or it is not a sign-in link. Sign in, or ask
            for a new email from the page that sent it.
          </Text>
          <Flex>
            <Button size="3" asChild>
              <Link href="/login">Sign in</Link>
            </Button>
          </Flex>
        </Flex>
      </Container>
    );
  }

  // Someone already signed in may be holding a link for another account,
  // and continuing switches to it; say so rather than switch silently.
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const copy = COPY[type];
  return (
    <Container size="1" px="4">
      <Flex direction="column" gap="4" py="9">
        <Heading size="6">{copy.heading}</Heading>

        <Card>
          <form action={confirmEmailLink}>
            <input type="hidden" name="token_hash" value={tokenHash} />
            <input type="hidden" name="type" value={type} />
            {next && <input type="hidden" name="next" value={next} />}
            <Flex direction="column" gap="3" p="2">
              <Text size="2">{copy.body}</Text>
              {user && (
                <Text size="2" color="gray">
                  You&apos;re signed in as <strong>{user.email}</strong>.
                  Continuing signs you in with this link instead, which may
                  be a different account.
                </Text>
              )}
              <Flex mt="1">
                <Button type="submit">{copy.button}</Button>
              </Flex>
            </Flex>
          </form>
        </Card>

        <Text size="2" color="gray">
          Didn&apos;t ask for this email? Close the page. Nothing happens
          unless you continue.
        </Text>
      </Flex>
    </Container>
  );
}
