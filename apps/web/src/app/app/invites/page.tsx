import { Badge, Button, Container, Flex, Heading, Text } from "@radix-ui/themes";
import { createClient } from "@/lib/supabase/server";
import { createInvite } from "@/lib/invites/actions";
import { CopyInviteLink } from "@/components/invites/CopyInviteLink";
import { FadeIn } from "@/components/FadeIn";

/**
 * Invite links to share while signups are invite-only — account plumbing,
 * which is why it lives here rather than in the Library. Every invite ever
 * created is listed (a redeemed one is still spent), newest first.
 *
 * No card: it would frame the entire page against nothing.
 */
export default async function InvitesPage() {
  const supabase = await createClient();

  const [{ data: settings }, { data: profile }, { data: invites }] = await Promise.all([
    supabase.from("app_settings").select("open_signups, invite_allowance").maybeSingle(),
    supabase.from("profiles").select("is_admin").maybeSingle(),
    supabase
      .from("invites")
      .select("code, created_at, redeemed_at")
      .order("created_at", { ascending: false }),
  ]);

  const isAdmin = profile?.is_admin ?? false;
  const used = invites?.length ?? 0;
  const left = Math.max((settings?.invite_allowance ?? 0) - used, 0);
  const canCreate = isAdmin || left > 0;

  return (
    <Container size="2" px="4">
      <FadeIn>
        <Flex direction="column" gap="4">
          <Heading size="6">Invites</Heading>

          {settings?.open_signups ? (
            <Text size="2" color="gray">
              Signups are open — nobody needs an invite right now.
            </Text>
          ) : (
            <>
              <Text size="2" color="gray">
                Signups are invite-only right now.{" "}
                {isAdmin
                  ? "As an admin you can create as many invites as you like."
                  : left > 0
                    ? `You can invite ${left} more ${left === 1 ? "person" : "people"}.`
                    : "You have used all your invites."}
              </Text>

              {invites && invites.length > 0 && (
                <Flex direction="column" gap="3">
                  {invites.map((invite) => (
                    <Flex
                      key={invite.code}
                      align="center"
                      gap="3"
                      pb="3"
                      style={{ borderBottom: "1px solid var(--gray-a4)" }}
                    >
                      {invite.redeemed_at ? (
                        <Badge size="1" color="gray" variant="soft">
                          Used
                        </Badge>
                      ) : (
                        <Badge size="1" color="green" variant="soft">
                          Open
                        </Badge>
                      )}
                      <Text
                        size="1"
                        color="gray"
                        style={{ fontFamily: "var(--code-font-family)", minWidth: 0 }}
                        truncate
                      >
                        {invite.code}
                      </Text>
                      {!invite.redeemed_at && <CopyInviteLink code={invite.code} />}
                    </Flex>
                  ))}
                </Flex>
              )}

              {canCreate && (
                <Flex>
                  <form action={createInvite}>
                    <Button type="submit">Create invite</Button>
                  </form>
                </Flex>
              )}
            </>
          )}
        </Flex>
      </FadeIn>
    </Container>
  );
}
