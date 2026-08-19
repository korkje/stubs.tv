import Link from "next/link";
import {
  Badge,
  Box,
  Button,
  Callout,
  Card,
  Container,
  Flex,
  Heading,
  RadioGroup,
  Separator,
  Tabs,
  Text,
  TextField,
} from "@radix-ui/themes";
import { createClient } from "@/lib/supabase/server";
import {
  changePassword,
  deleteAccount,
  updateSettings,
} from "@/lib/settings/actions";
import { FadeIn } from "@/components/FadeIn";
import { SpecialsField } from "@/components/settings/SpecialsField";
import { TimezoneField } from "@/components/settings/TimezoneField";

const TABS = new Set(["watching", "account", "billing"]);

/** Where subscribers manage payment, invoices, and cancellation. Polar hosts
 * it and authenticates by emailing a code — no app code involved. */
const POLAR_PORTAL_URL = "https://polar.sh/stubs-tv/portal";

/**
 * User settings, split by kind: watching (taste), account (identity),
 * billing (money). Every form posts only its own tab's fields and carries a
 * hidden tab input so the save round-trip lands back on the same tab. The
 * account tab also holds the GDPR self-serve flows: data export and account
 * deletion (docs/PRIVACY.md, ADR-0017).
 */
export default async function SettingsPage({
  searchParams,
}: {
  searchParams: Promise<{
    tab?: string;
    saved?: string;
    error?: string;
    password_saved?: string;
    password_error?: string;
    delete_error?: string;
  }>;
}) {
  const params = await searchParams;
  const { saved, error, password_saved, password_error, delete_error } = params;
  const tab = TABS.has(params.tab ?? "") ? params.tab! : "watching";

  const supabase = await createClient();
  const [{ data: profile }, { data: billing }, { data: userData }] =
    await Promise.all([
      supabase
        .from("profiles")
        .select(
          "display_name, timezone, specials, bulk_mark_specials, synopsis_mode, plan"
        )
        .maybeSingle(),
      supabase
        .from("billing")
        .select("lifetime, subscription_status, current_period_end")
        .maybeSingle(),
      supabase.auth.getUser(),
    ]);

  const email = userData?.user?.email ?? "";
  const plan = profile?.plan ?? "free";
  const renewsAt = billing?.current_period_end
    ? new Intl.DateTimeFormat("en", { dateStyle: "long" }).format(
        new Date(billing.current_period_end)
      )
    : null;

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

          <Tabs.Root defaultValue={tab}>
            <Tabs.List>
              <Tabs.Trigger value="watching">Watching</Tabs.Trigger>
              <Tabs.Trigger value="account">Account</Tabs.Trigger>
              <Tabs.Trigger value="billing">Billing</Tabs.Trigger>
            </Tabs.List>

            <Box pt="4">
              <Tabs.Content value="watching">
                <Card>
                  <form action={updateSettings}>
                    <input type="hidden" name="tab" value="watching" />
                    <Flex direction="column" gap="5" p="2">
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
                            profile?.synopsis_mode === "scramble"
                              ? "scramble"
                              : "show"
                          }
                        >
                          <RadioGroup.Item value="show">Show them</RadioGroup.Item>
                          <RadioGroup.Item value="scramble">
                            <Flex direction="column">
                              <Text size="2">Scramble them</Text>
                              <Text size="1" color="gray">
                                Marking an episode watched unscrambles its
                                synopsis.
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
              </Tabs.Content>

              <Tabs.Content value="account">
                <Flex direction="column" gap="4">
                  <Card>
                    <form action={updateSettings}>
                      <input type="hidden" name="tab" value="account" />
                      <Flex direction="column" gap="4" p="2">
                        <Flex direction="column" gap="2" align="start">
                          <Heading as="h2" size="3">
                            Email
                          </Heading>
                          <TextField.Root
                            defaultValue={email}
                            size="3"
                            disabled
                            style={{ width: "100%" }}
                          />
                          <Text size="1" color="gray">
                            This is the address you sign in with. Changing it
                            is not supported yet.
                          </Text>
                        </Flex>

                        <Separator size="4" />

                        <Flex direction="column" gap="2" align="start">
                          <Heading as="h2" size="3">
                            Display name
                          </Heading>
                          <TextField.Root
                            name="display_name"
                            defaultValue={profile?.display_name ?? ""}
                            size="3"
                            placeholder="How should we address you?"
                            style={{ width: "100%" }}
                          />
                        </Flex>

                        <Flex>
                          <Button type="submit">Save account</Button>
                        </Flex>
                      </Flex>
                    </form>
                  </Card>

                  {/* Its own form and its own messages: a password has no
                      business riding along with a display name. */}
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
                          {/* size 3 is 16px: anything smaller makes iOS Safari
                              zoom in when the field is focused. */}
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

                  <Card>
                    <Flex direction="column" gap="2" p="2" align="start">
                      <Heading as="h2" size="3">
                        Your data
                      </Heading>
                      <Text size="2" color="gray">
                        Download everything stubs.tv knows about you — your
                        profile, follows, watch history, ratings, and imports —
                        as a single JSON file. It works on every plan, always.
                      </Text>
                      <Button asChild variant="soft" mt="1">
                        <a href="/app/export" download>
                          Download my data
                        </a>
                      </Button>
                    </Flex>
                  </Card>

                  {/* Deletion asks for the password, not just a click: a
                      session alone is not proof the person at the keyboard
                      is the owner, same reasoning as changePassword. */}
                  <Card>
                    <form action={deleteAccount}>
                      <Flex direction="column" gap="3" p="2">
                        <Heading as="h2" size="3" color="red">
                          Delete account
                        </Heading>

                        {delete_error && (
                          <Callout.Root color="red">
                            <Callout.Text>{delete_error}</Callout.Text>
                          </Callout.Root>
                        )}

                        <Text size="2" color="gray">
                          Permanently deletes your account and everything in
                          it — watch history, follows, ratings, imports. There
                          is no undo and no grace period; export your data
                          first if you want to keep it. Any active
                          subscription is cancelled as part of this.
                        </Text>

                        <label>
                          <Text as="div" size="2" mb="1" weight="medium">
                            Confirm with your password
                          </Text>
                          <TextField.Root
                            name="current_password"
                            type="password"
                            autoComplete="current-password"
                            size="3"
                            required
                          />
                        </label>

                        <Flex mt="1">
                          <Button type="submit" color="red" variant="solid">
                            Delete my account
                          </Button>
                        </Flex>
                      </Flex>
                    </form>
                  </Card>
                </Flex>
              </Tabs.Content>

              <Tabs.Content value="billing">
                <Card>
                  <Flex direction="column" gap="4" p="2">
                    <Flex align="center" gap="2">
                      <Heading as="h2" size="3">
                        Your plan
                      </Heading>
                      {plan === "comp" && <Badge color="amber">Complimentary</Badge>}
                      {plan === "paid" && billing?.lifetime && (
                        <Badge color="amber">Lifetime</Badge>
                      )}
                      {plan === "paid" && !billing?.lifetime && (
                        <Badge color="green">
                          {billing?.subscription_status === "trialing"
                            ? "Trial"
                            : "Subscribed"}
                        </Badge>
                      )}
                      {plan === "free" && <Badge color="gray">Read-only</Badge>}
                    </Flex>

                    {plan === "comp" && (
                      <Text size="2" color="gray">
                        Full access, on the house. Nothing to pay, nothing to
                        manage.
                      </Text>
                    )}

                    {plan === "paid" && billing?.lifetime && (
                      <Text size="2" color="gray">
                        Lifetime access — paid once, yours for good.
                      </Text>
                    )}

                    {plan === "paid" &&
                      !billing?.lifetime &&
                      (billing?.subscription_status === "trialing" ? (
                        <Text size="2" color="gray">
                          Free trial{renewsAt ? ` — first payment ${renewsAt}` : ""}.
                          Cancel before then and you pay nothing.
                        </Text>
                      ) : (
                        <Text size="2" color="gray">
                          Subscription active
                          {renewsAt ? ` — renews ${renewsAt}` : ""}.
                        </Text>
                      ))}

                    {plan === "free" && (
                      <Text size="2" color="gray">
                        Your account is read-only: everything stays visible and
                        exportable, but tracking needs a plan.
                      </Text>
                    )}

                    <Flex gap="3">
                      {plan === "free" && (
                        <Button asChild>
                          <Link href="/app/plans">Choose a plan</Link>
                        </Button>
                      )}
                      {billing && (
                        <Button
                          asChild
                          variant="soft"
                          // Polar (the merchant of record) hosts the portal
                          // and signs the customer in with an emailed code.
                        >
                          <a href={POLAR_PORTAL_URL} target="_blank" rel="noreferrer">
                            Manage billing on Polar
                          </a>
                        </Button>
                      )}
                    </Flex>

                    {billing && (
                      <Text size="1" color="gray">
                        Payment details, invoices, and cancellation live in
                        Polar&apos;s customer portal — it signs you in with a
                        code sent to your email.
                      </Text>
                    )}
                  </Flex>
                </Card>
              </Tabs.Content>
            </Box>
          </Tabs.Root>
        </Flex>
      </FadeIn>
    </Container>
  );
}
