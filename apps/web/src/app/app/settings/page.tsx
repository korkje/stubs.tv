import {
  Button,
  Callout,
  Card,
  Container,
  Flex,
  Heading,
  RadioGroup,
  Separator,
  Text,
  TextField,
} from "@radix-ui/themes";
import { createClient } from "@/lib/supabase/server";
import { changePassword, updateSettings } from "@/lib/settings/actions";
import { FadeIn } from "@/components/FadeIn";
import { SpecialsField } from "@/components/settings/SpecialsField";
import { TimezoneField } from "@/components/settings/TimezoneField";

/**
 * User settings. Everything here started life as an app default that turned
 * out to be a matter of taste; the account-and-privacy section (data export,
 * account deletion) will join once those flows exist.
 */
export default async function SettingsPage({
  searchParams,
}: {
  searchParams: Promise<{
    saved?: string;
    error?: string;
    password_saved?: string;
    password_error?: string;
  }>;
}) {
  const { saved, error, password_saved, password_error } = await searchParams;

  const supabase = await createClient();
  const { data: profile } = await supabase
    .from("profiles")
    .select("display_name, timezone, specials, bulk_mark_specials, synopsis_mode")
    .maybeSingle();

  return (
    <Container size="2" px="4">
      <FadeIn>
        <Flex direction="column" gap="4">
          <Heading size="6">Settings</Heading>

          {saved && (
            <Callout.Root color="green">
              <Callout.Text>Saved.</Callout.Text>
            </Callout.Root>
          )}
          {error && (
            <Callout.Root color="red">
              <Callout.Text>{error}</Callout.Text>
            </Callout.Root>
          )}

          <Card>
            <form action={updateSettings}>
              <Flex direction="column" gap="5" p="2">
                <Flex direction="column" gap="2" align="start">
                  <Heading as="h2" size="3">
                    Profile
                  </Heading>
                  <label style={{ width: "100%" }}>
                    <Text as="div" size="2" mb="1" weight="medium">
                      Display name
                    </Text>
                    <TextField.Root
                      name="display_name"
                      defaultValue={profile?.display_name ?? ""}
                      size="3"
                      placeholder="How should we address you?"
                    />
                  </label>
                </Flex>

                <Separator size="4" />

                <Flex direction="column" gap="2" align="start">
                  <Heading as="h2" size="3">
                    Time zone
                  </Heading>
                  <TimezoneField initial={profile?.timezone ?? ""} />
                </Flex>

                <Separator size="4" />

                <Flex direction="column" gap="2" align="start">
                  <Heading as="h2" size="3">
                    Specials
                  </Heading>
                  <SpecialsField
                    initialSpecials={profile?.specials ?? "uncounted"}
                    initialBulk={profile?.bulk_mark_specials ?? true}
                  />
                </Flex>

                <Separator size="4" />

                <Flex direction="column" gap="2" align="start">
                  <Heading as="h2" size="3">
                    Episode synopses
                  </Heading>
                  <Text size="1" color="gray">
                    For episodes you have not watched yet.
                  </Text>
                  <RadioGroup.Root
                    name="synopsis_mode"
                    defaultValue={
                      profile?.synopsis_mode === "scramble" ? "scramble" : "show"
                    }
                  >
                    <RadioGroup.Item value="show">Show them</RadioGroup.Item>
                    <RadioGroup.Item value="scramble">
                      <Flex direction="column">
                        <Text size="2">Scramble them</Text>
                        <Text size="1" color="gray">
                          Marking an episode watched unscrambles its synopsis.
                        </Text>
                      </Flex>
                    </RadioGroup.Item>
                  </RadioGroup.Root>
                </Flex>

                <Flex>
                  <Button type="submit">Save settings</Button>
                </Flex>
              </Flex>
            </form>
          </Card>

          {/* Its own form and its own messages: the settings form above posts
              every field it contains, and a password has no business riding
              along with a timezone. */}
          <Card>
            <form action={changePassword}>
              <Flex direction="column" gap="3" p="2">
                <Heading as="h2" size="3">
                  Password
                </Heading>

                {password_saved && (
                  <Callout.Root color="green">
                    <Callout.Text>Password changed.</Callout.Text>
                  </Callout.Root>
                )}
                {password_error && (
                  <Callout.Root color="red">
                    <Callout.Text>{password_error}</Callout.Text>
                  </Callout.Root>
                )}

                <label>
                  <Text as="div" size="2" mb="1" weight="medium">
                    Current password
                  </Text>
                  {/* size 3 is 16px: anything smaller makes iOS Safari zoom
                      in when the field is focused. */}
                  <TextField.Root
                    name="current_password"
                    type="password"
                    autoComplete="current-password"
                    size="3"
                    required
                  />
                </label>
                <label>
                  <Text as="div" size="2" mb="1" weight="medium">
                    New password
                  </Text>
                  <TextField.Root
                    name="new_password"
                    type="password"
                    autoComplete="new-password"
                    size="3"
                    required
                  />
                </label>

                <Flex mt="1">
                  <Button type="submit">Change password</Button>
                </Flex>
              </Flex>
            </form>
          </Card>
        </Flex>
      </FadeIn>
    </Container>
  );
}
