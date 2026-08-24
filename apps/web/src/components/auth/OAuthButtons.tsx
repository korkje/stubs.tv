import { Button, Flex, Separator, Text } from "@radix-ui/themes";
import { OAUTH_PROVIDER_LABELS, type OAuthProvider } from "@/lib/auth/providers";
import { signInWithProvider } from "@/app/login/actions";

/** The providers' marks, inline so no request leaves the page for them.
 *  currentColor for Apple so the mark follows the button's foreground. */
function ProviderMark({ provider }: { provider: OAuthProvider }) {
  if (provider === "google") {
    return (
      <svg width="16" height="16" viewBox="0 0 24 24" aria-hidden="true">
        <path
          fill="#4285F4"
          d="M23.5 12.27c0-.85-.08-1.66-.22-2.45H12v4.64h6.45a5.52 5.52 0 0 1-2.4 3.62v3h3.87c2.27-2.09 3.58-5.17 3.58-8.81Z"
        />
        <path
          fill="#34A853"
          d="M12 24c3.24 0 5.96-1.07 7.94-2.91l-3.87-3c-1.08.72-2.45 1.15-4.07 1.15-3.13 0-5.78-2.11-6.73-4.96H1.29v3.1A12 12 0 0 0 12 24Z"
        />
        <path
          fill="#FBBC05"
          d="M5.27 14.28A7.2 7.2 0 0 1 4.9 12c0-.79.14-1.56.37-2.28v-3.1H1.29a12 12 0 0 0 0 10.76l3.98-3.1Z"
        />
        <path
          fill="#EA4335"
          d="M12 4.77c1.77 0 3.35.61 4.6 1.8l3.42-3.42A11.97 11.97 0 0 0 12 0 12 12 0 0 0 1.29 6.62l3.98 3.1C6.22 6.88 8.87 4.77 12 4.77Z"
        />
      </svg>
    );
  }
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" aria-hidden="true">
      <path
        fill="currentColor"
        d="M16.72 12.7c.03 3.22 2.82 4.29 2.85 4.3-.02.08-.44 1.53-1.47 3.02-.89 1.29-1.8 2.57-3.25 2.6-1.42.03-1.88-.84-3.5-.84-1.63 0-2.14.81-3.48.87-1.4.05-2.46-1.4-3.35-2.68C2.68 17.35 1.3 12.55 3.17 9.3a5.18 5.18 0 0 1 4.38-2.66c1.37-.03 2.66.92 3.5.92.84 0 2.41-1.14 4.06-.97.69.03 2.63.28 3.88 2.1-.1.07-2.31 1.36-2.27 4.02ZM14.05 4.85c.74-.9 1.24-2.14 1.1-3.38-1.07.04-2.35.71-3.12 1.6-.68.79-1.28 2.06-1.12 3.27 1.19.1 2.4-.6 3.14-1.5Z"
      />
    </svg>
  );
}

/**
 * The "Continue with …" buttons shared by login and signup — rendered only
 * for providers named in AUTH_PROVIDERS, so a bare self-hosted instance
 * shows none of this. Plain forms into one server action: the OAuth dance
 * is a redirect, no client JS needed. `next` rides along into the
 * /auth/callback round trip.
 */
export function OAuthButtons({
  providers,
  next,
}: {
  providers: OAuthProvider[];
  next?: string | null;
}) {
  if (providers.length === 0) return null;

  return (
    <Flex direction="column" gap="3">
      {providers.map((provider) => (
        <form key={provider} action={signInWithProvider}>
          <input type="hidden" name="provider" value={provider} />
          {next && <input type="hidden" name="next" value={next} />}
          <Button
            type="submit"
            size="3"
            variant="surface"
            color="gray"
            highContrast
            style={{ width: "100%" }}
          >
            <ProviderMark provider={provider} />
            Continue with {OAUTH_PROVIDER_LABELS[provider]}
          </Button>
        </form>
      ))}
      <Flex align="center" gap="3">
        <Separator size="4" style={{ flex: 1 }} />
        <Text size="1" color="gray">
          or
        </Text>
        <Separator size="4" style={{ flex: 1 }} />
      </Flex>
    </Flex>
  );
}
