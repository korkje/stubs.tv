import {
  Button,
  Callout,
  Card,
  Container,
  Flex,
  Heading,
  RadioGroup,
  Separator,
  Switch,
  Text,
  TextField,
} from "@radix-ui/themes";
import { createClient } from "@/lib/supabase/server";
import { updateSettings } from "@/lib/settings/actions";
import { FadeIn } from "@/components/FadeIn";
import { TimezoneField } from "@/components/settings/TimezoneField";

/**
 * User settings. Everything here started life as an app default that turned
 * out to be a matter of taste; the account-and-privacy section (data export,
 * account deletion) will join once those flows exist.
 */
export default async function SettingsPage({
  searchParams,
}: {
  searchParams: Promise<{ saved?: string; error?: string }>;
}) {
  const { saved, error } = await searchParams;

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
                    Timezone
                  </Heading>
                  <TimezoneField initial={profile?.timezone ?? ""} />
                </Flex>

                <Separator size="4" />

                <Flex direction="column" gap="2" align="start">
                  <Heading as="h2" size="3">
                    Specials
                  </Heading>
                  <RadioGroup.Root
                    name="specials"
                    defaultValue={profile?.specials ?? "uncounted"}
                  >
                    <RadioGroup.Item value="uncounted">
                      Show, but don&apos;t count — listed on show pages, left out
                      of progress and the home feed
                    </RadioGroup.Item>
                    <RadioGroup.Item value="counted">
                      Count everywhere — progress, the home feed, all of it
                    </RadioGroup.Item>
                    <RadioGroup.Item value="hidden">
                      Hide entirely — as if specials did not exist
                    </RadioGroup.Item>
                  </RadioGroup.Root>
                  <Text as="label" size="2">
                    <Flex gap="2" align="center">
                      <Switch
                        name="bulk_mark_specials"
                        defaultChecked={profile?.bulk_mark_specials ?? true}
                      />
                      “Mark show” also marks specials (unless hidden)
                    </Flex>
                  </Text>
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
                    defaultValue={profile?.synopsis_mode ?? "show"}
                  >
                    <RadioGroup.Item value="show">Show them</RadioGroup.Item>
                    <RadioGroup.Item value="scramble">
                      Scramble them — unscramble one with a click
                    </RadioGroup.Item>
                    <RadioGroup.Item value="hide">Hide them</RadioGroup.Item>
                  </RadioGroup.Root>
                </Flex>

                <Flex>
                  <Button type="submit">Save settings</Button>
                </Flex>
              </Flex>
            </form>
          </Card>
        </Flex>
      </FadeIn>
    </Container>
  );
}
