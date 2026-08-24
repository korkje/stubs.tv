import Link from "next/link";
import {
  Badge,
  Button,
  Callout,
  Card,
  Flex,
  Heading,
  Link as RadixLink,
  Text,
} from "@radix-ui/themes";
import type { UserIdentity } from "@supabase/supabase-js";
import {
  OAUTH_PROVIDER_LABELS,
  type OAuthProvider,
} from "@/lib/auth/providers";
import { linkProvider, unlinkProvider } from "@/lib/settings/actions";

/**
 * Settings → Account → "Sign-in methods": one row per way into the account.
 * Connect attaches a provider to *this* account whatever its email — the
 * escape hatch for Apple relay addresses, where email matching can never
 * link automatically (docs/plans/oauth-login.md, collision matrix).
 * Disconnect hides on the last remaining method; GoTrue enforces the same
 * rule server-side.
 */
export function SignInMethods({
  identities,
  enabled,
  linked,
  unlinked,
  linkError,
}: {
  identities: UserIdentity[];
  enabled: OAuthProvider[];
  linked: boolean;
  unlinked: boolean;
  linkError?: string;
}) {
  const connected = new Set(identities.map((identity) => identity.provider));
  const hasPassword = connected.has("email");
  const canDisconnect = identities.length >= 2;

  // Connected providers always show (even if since removed from the env);
  // connectable ones only when this deployment offers them.
  const providers = [
    ...new Set<OAuthProvider>([
      ...enabled,
      ...(["google", "apple"] as const).filter((p) => connected.has(p)),
    ]),
  ];

  return (
    <Card>
      <Flex direction="column" gap="3" p="2">
        <Heading as="h2" size="3">
          Sign-in methods
        </Heading>

        {linked && (
          <Callout.Root color="green">
            <Callout.Text>Connected.</Callout.Text>
          </Callout.Root>
        )}
        {unlinked && (
          <Callout.Root color="green">
            <Callout.Text>Disconnected.</Callout.Text>
          </Callout.Root>
        )}
        {linkError && (
          <Callout.Root color="red">
            <Callout.Text>{linkError}</Callout.Text>
          </Callout.Root>
        )}

        <Flex direction="column" gap="2">
          <Flex align="center" justify="between" gap="3">
            <Text size="2">Email &amp; password</Text>
            {hasPassword ? (
              <Badge color="green">Connected</Badge>
            ) : (
              <Text size="2" color="gray">
                Set one via{" "}
                <RadixLink asChild>
                  <Link href="/forgot-password">password reset</Link>
                </RadixLink>
              </Text>
            )}
          </Flex>

          {providers.map((provider) => (
            <Flex key={provider} align="center" justify="between" gap="3">
              <Text size="2">{OAUTH_PROVIDER_LABELS[provider]}</Text>
              {connected.has(provider) ? (
                canDisconnect ? (
                  <form action={unlinkProvider}>
                    <input type="hidden" name="provider" value={provider} />
                    <Button type="submit" size="1" variant="soft" color="red">
                      Disconnect
                    </Button>
                  </form>
                ) : (
                  <Badge color="green">Connected</Badge>
                )
              ) : (
                <form action={linkProvider}>
                  <input type="hidden" name="provider" value={provider} />
                  <Button type="submit" size="1" variant="soft">
                    Connect
                  </Button>
                </form>
              )}
            </Flex>
          ))}
        </Flex>

        <Text size="1" color="gray">
          Connecting adds another way into this same account — including a
          Google or Apple account with a different email address.
        </Text>
      </Flex>
    </Card>
  );
}
