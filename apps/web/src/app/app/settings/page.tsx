import Link from "next/link";
import { headers } from "next/headers";
import {
  AlertDialog,
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
import { isSelfHosted } from "@/lib/self-hosted";
import {
  deleteAccount,
  regenerateCalendarToken,
  updateSettings,
} from "@/lib/settings/actions";
import { FadeIn } from "@/components/FadeIn";
import { PasswordField } from "@/components/auth/PasswordField";
import { SignInMethods } from "@/components/settings/SignInMethods";
import { enabledProviders } from "@/lib/auth/providers";
import { ImportSection } from "@/components/import/ImportSection";
import { SettingsTabs } from "@/components/SettingsTabs";
import { CopyUrlField } from "@/components/settings/CopyUrlField";
import { SpecialsField } from "@/components/settings/SpecialsField";
import { TimezoneField } from "@/components/settings/TimezoneField";

const TABS = new Set(["watching", "account", "billing", "import"]);

// Self-hosted instances have no billing to manage (ADR-0019); the tab —
// and a ?tab=billing deep link — falls away with it.
const SELF_HOSTED_TABS = new Set(["watching", "account", "import"]);

/** Where subscribers manage payment, invoices, and cancellation: our
 * /billing route creates an authenticated Polar portal session (signed in
 * already, no emailed code) and falls back to Polar's code-based entrance
 * if the session can't be created. */
const BILLING_PORTAL_PATH = "/billing";

/**
 * User settings, split by kind: watching (taste), account (identity),
 * billing (money), import (bringing history in). Every form posts only its
 * own tab's fields and carries a hidden tab input so the save round-trip
 * lands back on the same tab; plain tab clicks persist through
 * SettingsTabs, which writes ?tab= without a round-trip. The account tab
 * also holds the GDPR self-serve flows: data export and account deletion
 * (docs/PRIVACY.md, ADR-0017).
 */
export default async function SettingsPage({
  searchParams,
}: {
  searchParams: Promise<{
    tab?: string;
    saved?: string;
    error?: string;
    delete_error?: string;
    calendar_saved?: string;
    linked?: string;
    unlinked?: string;
    email_sent?: string;
    link_error?: string;
  }>;
}) {
  const params = await searchParams;
  const {
    saved,
    error,
    delete_error,
    calendar_saved,
    linked,
    unlinked,
    email_sent,
    link_error,
  } = params;
  const selfHosted = isSelfHosted();
  const tabs = selfHosted ? SELF_HOSTED_TABS : TABS;
  const tab = tabs.has(params.tab ?? "") ? params.tab! : "watching";

  const supabase = await createClient();
  const [{ data: profile }, { data: billing }, { data: userData }] =
    await Promise.all([
      supabase
        .from("profiles")
        .select(
          "display_name, timezone, specials, bulk_mark_specials, synopsis_mode, plan, calendar_token"
        )
        .maybeSingle(),
      supabase
        .from("billing")
        .select("lifetime, subscription_status, current_period_end")
        .maybeSingle(),
      supabase.auth.getUser(),
    ]);
  const { data: identityData } = await supabase.auth.getUserIdentities();
  const identities = identityData?.identities ?? [];
  // The 'email' identity tracks the password reliably since ADR-0020 keeps
  // the two in sync (every proven password materializes the row; disconnect
  // removes both). Accounts from before that heal on their next password
  // sign-in — until then this reads false and they see "Set up", which
  // also converges them.
  const hasPassword = identities.some((i) => i.provider === "email");

  const email = userData?.user?.email ?? "";
  const plan = profile?.plan ?? "free";

  // The feed URL must be absolute (it gets pasted into a calendar app), so
  // derive the origin from the request — works in production, locally, and
  // self-hosted without configuration.
  const requestHeaders = await headers();
  const host =
    requestHeaders.get("x-forwarded-host") ?? requestHeaders.get("host");
  const proto = requestHeaders.get("x-forwarded-proto") ?? "https";
  const calendarUrl =
    profile?.calendar_token && host
      ? `${proto}://${host}/api/calendar/${profile.calendar_token}.ics`
      : null;
  // current_period_end is an instant (timestamptz); without an explicit
  // timeZone the formatter falls back to the runtime's zone — UTC on
  // Workers — showing users near a period boundary the wrong day.
  const renewsAt = billing?.current_period_end
    ? new Intl.DateTimeFormat("en", {
        dateStyle: "long",
        timeZone: profile?.timezone ?? "UTC",
      }).format(new Date(billing.current_period_end))
    : null;

  return (
    // size 3 like every other page — settings being the one narrow page
    // read as a glitch rather than a choice.
    <Container size="3" px="4">
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

          <SettingsTabs defaultValue={tab}>
            <Tabs.List>
              <Tabs.Trigger value="watching">Watching</Tabs.Trigger>
              <Tabs.Trigger value="account">Account</Tabs.Trigger>
              {!selfHosted && (
                <Tabs.Trigger value="billing">Billing</Tabs.Trigger>
              )}
              <Tabs.Trigger value="import">Import</Tabs.Trigger>
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

                {calendarUrl && (
                  <Card mt="4">
                    <Flex direction="column" gap="2" p="2" align="start">
                      <Heading as="h2" size="3">
                        Calendar
                      </Heading>

                      {calendar_saved && (
                        <Callout.Root color="green" style={{ width: "100%" }}>
                          <Callout.Text>
                            New link created. Anywhere the old one was added
                            stopped updating — resubscribe with this one.
                          </Callout.Text>
                        </Callout.Root>
                      )}

                      <Text size="2" color="gray">
                        Upcoming episodes of the shows you follow, as a
                        calendar your phone or computer keeps updated by
                        itself. Subscribe to the URL — don&apos;t import the
                        file, an import is a one-time snapshot. In Apple
                        Calendar: File → New Calendar Subscription. In Google
                        Calendar: Other calendars → From URL.
                      </Text>

                      <CopyUrlField url={calendarUrl} />

                      <Text size="1" color="gray">
                        The link is private to you: anyone who has it can see
                        your upcoming episodes. If it leaks, make a new one.
                      </Text>

                      {/* Regeneration invalidates every existing
                          subscription, hence the confirmation. */}
                      <AlertDialog.Root>
                        <AlertDialog.Trigger>
                          <Button variant="soft" color="red" type="button">
                            Make a new link
                          </Button>
                        </AlertDialog.Trigger>
                        <AlertDialog.Content maxWidth="420px">
                          <AlertDialog.Title>
                            Make a new calendar link?
                          </AlertDialog.Title>
                          <AlertDialog.Description size="2">
                            The current link stops working immediately.
                            Calendars subscribed to it will stop updating
                            until you resubscribe with the new one.
                          </AlertDialog.Description>
                          <Flex gap="3" mt="4" justify="end">
                            <AlertDialog.Cancel>
                              <Button variant="soft" color="gray">
                                Keep the current link
                              </Button>
                            </AlertDialog.Cancel>
                            <form action={regenerateCalendarToken}>
                              <AlertDialog.Action>
                                <Button type="submit" color="red">
                                  Make a new link
                                </Button>
                              </AlertDialog.Action>
                            </form>
                          </Flex>
                        </AlertDialog.Content>
                      </AlertDialog.Root>
                    </Flex>
                  </Card>
                )}
              </Tabs.Content>

              <Tabs.Content value="account">
                <Flex direction="column" gap="4">
                  <Card>
                    <form action={updateSettings}>
                      <input type="hidden" name="tab" value="account" />
                      <Flex direction="column" gap="4" p="2">
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

                  <SignInMethods
                    identities={identities}
                    enabled={enabledProviders()}
                    email={email}
                    linked={linked === "1"}
                    unlinked={unlinked === "1"}
                    emailSent={email_sent === "1"}
                    linkError={link_error}
                  />

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
                      is the owner, same reasoning as the reset flow's
                      refusal to trust sessions. */}
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

                        {hasPassword ? (
                          <>
                            <label>
                              <Text as="div" size="2" mb="1" weight="medium">
                                Confirm with your password
                              </Text>
                              <PasswordField
                                name="current_password"
                                autoComplete="current-password"
                              />
                            </label>

                            <Flex mt="1">
                              <Button type="submit" color="red" variant="solid">
                                Delete my account
                              </Button>
                            </Flex>
                          </>
                        ) : (
                          <Text size="2" color="gray">
                            Deletion is confirmed with a password, and your
                            account doesn&apos;t have one yet — use{" "}
                            <Text weight="medium">Set up</Text> under
                            Sign-in methods above first, then delete from
                            here.
                          </Text>
                        )}
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
                          // Polar (the merchant of record) hosts the portal;
                          // /billing signs the customer straight in.
                        >
                          <a
                            href={BILLING_PORTAL_PATH}
                            target="_blank"
                            rel="noreferrer"
                          >
                            Manage billing on Polar
                          </a>
                        </Button>
                      )}
                    </Flex>

                    {billing && (
                      <Text size="1" color="gray">
                        Payment details, invoices, and cancellation live in
                        Polar&apos;s customer portal — the button signs you in
                        with your account here.
                      </Text>
                    )}
                  </Flex>
                </Card>
              </Tabs.Content>

              <Tabs.Content value="import">
                <ImportSection />
              </Tabs.Content>
            </Box>
          </SettingsTabs>
        </Flex>
      </FadeIn>
    </Container>
  );
}
