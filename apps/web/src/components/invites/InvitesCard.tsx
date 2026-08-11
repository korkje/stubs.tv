import { Badge, Button, Card, Flex, Heading, Text } from "@radix-ui/themes";
import { createClient } from "@/lib/supabase/server";
import { createInvite } from "@/lib/invites/actions";
import { CopyInviteLink } from "./CopyInviteLink";

/**
 * Invite links to share while signups are invite-only. Every invite ever
 * created is listed (a redeemed one is still spent), newest first. Hidden
 * entirely once signups are open — the whole point of the card disappears.
 */
export async function InvitesCard() {
  const supabase = await createClient();

  const [{ data: settings }, { data: profile }, { data: invites }] = await Promise.all([
    supabase.from("app_settings").select("open_signups, invite_allowance").maybeSingle(),
    supabase.from("profiles").select("is_admin").maybeSingle(),
    supabase
      .from("invites")
      .select("code, created_at, redeemed_at")
      .order("created_at", { ascending: false }),
  ]);

  if (settings?.open_signups) return null;

  const isAdmin = profile?.is_admin ?? false;
  const used = invites?.length ?? 0;
  const left = Math.max((settings?.invite_allowance ?? 0) - used, 0);
  const canCreate = isAdmin || left > 0;

  return (
    <Card>
      <Flex direction="column" gap="3" p="2">
        <Heading as="h2" size="3">
          Invites
        </Heading>
        <Text size="2" color="gray">
          Signups are invite-only right now.{" "}
          {isAdmin
            ? "As an admin you can create as many invites as you like."
            : left > 0
              ? `You can invite ${left} more ${left === 1 ? "person" : "people"}.`
              : "You have used all your invites."}
        </Text>

        {invites && invites.length > 0 && (
          <Flex direction="column" gap="2">
            {invites.map((invite) => (
              <Flex key={invite.code} align="center" gap="2">
                {invite.redeemed_at ? (
                  <Badge size="1" color="gray" variant="soft">
                    Used
                  </Badge>
                ) : (
                  <Badge size="1" color="green" variant="soft">
                    Open
                  </Badge>
                )}
                <Text size="1" color="gray" style={{ fontFamily: "var(--code-font-family)" }}>
                  {invite.code}
                </Text>
                {!invite.redeemed_at && <CopyInviteLink code={invite.code} />}
              </Flex>
            ))}
          </Flex>
        )}

        {canCreate && (
          <form action={createInvite}>
            <Button size="2" variant="soft" type="submit">
              Create invite
            </Button>
          </form>
        )}
      </Flex>
    </Card>
  );
}
