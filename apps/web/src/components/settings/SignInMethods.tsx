import {
  Badge,
  Button,
  Callout,
  Card,
  Flex,
  Heading,
  Text,
} from "@radix-ui/themes";
import type { UserIdentity } from "@supabase/supabase-js";
import {
  OAUTH_PROVIDER_LABELS,
  type OAuthProvider,
} from "@/lib/auth/providers";
import {
  linkProvider,
  sendPasswordEmail,
  unlinkEmailLogin,
  unlinkProvider,
} from "@/lib/settings/actions";

/**
 * Settings → Account → "Sign-in methods": one row per way into the account,
 * each showing the email it is tied to. Email/password is a row like any
 * other: set up and changed through an emailed link (sendPasswordEmail —
 * there is no in-place password form), disconnectable like a provider.
 * Connect attaches a provider to *this* account whatever its email — the
 * escape hatch for Apple relay addresses, where email matching can never
 * link automatically (docs/plans/oauth-login.md, collision matrix).
 * Disconnect hides on the last remaining method; the server enforces the
 * same rule (GoTrue for providers, remove_email_login for email/password).
 */
export function SignInMethods({
  identities,
  enabled,
  email,
  linked,
  unlinked,
  emailSent,
  linkError,
}: {
  identities: UserIdentity[];
  enabled: OAuthProvider[];
  email: string;
  linked: boolean;
  unlinked: boolean;
  emailSent: boolean;
  linkError?: string;
}) {
  const connected = new Set(identities.map((identity) => identity.provider));
  const hasPassword = connected.has("email");
  const canDisconnect = identities.length >= 2;

  const identityEmail = (provider: string) =>
    identities.find((i) => i.provider === provider)?.identity_data?.email as
      | string
      | undefined;

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
        {emailSent && (
          <Callout.Root color="green">
            <Callout.Text>
              Check your inbox — we sent {email} a link to set your password.
            </Callout.Text>
          </Callout.Root>
        )}
        {linkError && (
          <Callout.Root color="red">
            <Callout.Text>{linkError}</Callout.Text>
          </Callout.Root>
        )}

        <Flex direction="column" gap="3">
          <Flex align="center" justify="between" gap="3">
            <Flex direction="column">
              <Text size="2">Email &amp; password</Text>
              {hasPassword && (
                <Text size="1" color="gray">
                  {email}
                </Text>
              )}
            </Flex>
            {hasPassword ? (
              <Flex gap="2">
                <form action={sendPasswordEmail}>
                  <Button type="submit" size="1" variant="soft">
                    Change password
                  </Button>
                </form>
                {canDisconnect && (
                  <form action={unlinkEmailLogin}>
                    <Button type="submit" size="1" variant="soft" color="red">
                      Disconnect
                    </Button>
                  </form>
                )}
              </Flex>
            ) : (
              <form action={sendPasswordEmail}>
                <Button type="submit" size="1" variant="soft">
                  Set up
                </Button>
              </form>
            )}
          </Flex>

          {providers.map((provider) => (
            <Flex key={provider} align="center" justify="between" gap="3">
              <Flex direction="column">
                <Text size="2">{OAUTH_PROVIDER_LABELS[provider]}</Text>
                {connected.has(provider) && (
                  <Text size="1" color="gray">
                    {identityEmail(provider) ?? "Connected"}
                  </Text>
                )}
              </Flex>
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
          Setting or changing the password happens through a link emailed to{" "}
          {email}. Connecting adds another way into this same account —
          including a Google or Apple account with a different email address.
        </Text>
      </Flex>
    </Card>
  );
}
