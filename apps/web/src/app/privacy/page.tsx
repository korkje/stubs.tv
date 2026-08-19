import type { Metadata } from "next";
import { Container, Flex, Heading, Table, Text } from "@radix-ui/themes";

export const metadata: Metadata = {
  title: "Privacy — stubs.tv",
  description: "What stubs.tv stores, where it lives, and your rights.",
};

/**
 * Plain-language privacy policy, kept in lockstep with docs/PRIVACY.md —
 * change that doc and this page together.
 */
export default function PrivacyPage() {
  return (
    <Container size="2" px="4">
      <Flex direction="column" gap="5" py="9">
        <Heading size="7">Privacy</Heading>
        <Text size="3" color="gray">
          stubs.tv stores as little about you as it can get away with, keeps
          it in the EU, and never sells or shares it. Your watch history is
          your data.
        </Text>

        <Heading size="4">What we store</Heading>
        <Text size="3" color="gray">
          Your email address (to sign you in), a display name if you set one,
          your plan, and the history you build in the app: follows, watches,
          ratings, and your settings. That is the whole list. There are no
          analytics scripts, no trackers, and no advertising on stubs.tv.
        </Text>

        <Heading size="4">Where it lives</Heading>
        <Table.Root size="1">
          <Table.Header>
            <Table.Row>
              <Table.ColumnHeaderCell>Processor</Table.ColumnHeaderCell>
              <Table.ColumnHeaderCell>Purpose</Table.ColumnHeaderCell>
              <Table.ColumnHeaderCell>Data</Table.ColumnHeaderCell>
            </Table.Row>
          </Table.Header>
          <Table.Body>
            <Table.Row>
              <Table.Cell>Supabase (EU, Frankfurt)</Table.Cell>
              <Table.Cell>Database and sign-in</Table.Cell>
              <Table.Cell>Email, account data, watch history</Table.Cell>
            </Table.Row>
            <Table.Row>
              <Table.Cell>Cloudflare</Table.Cell>
              <Table.Cell>Hosting, CDN, DNS</Table.Cell>
              <Table.Cell>Request metadata (IPs in transit)</Table.Cell>
            </Table.Row>
            <Table.Row>
              <Table.Cell>Mailjet (EU)</Table.Cell>
              <Table.Cell>Transactional email</Table.Cell>
              <Table.Cell>Email address</Table.Cell>
            </Table.Row>
            <Table.Row>
              <Table.Cell>Polar</Table.Cell>
              <Table.Cell>Payments (merchant of record)</Table.Cell>
              <Table.Cell>
                Billing details — card numbers never reach stubs.tv
              </Table.Cell>
            </Table.Row>
          </Table.Body>
        </Table.Root>
        <Text size="3" color="gray">
          TheTVDB, the metadata source, receives no user data — those requests
          run server-side and carry no user identifiers.
        </Text>

        <Heading size="4">Cookies</Heading>
        <Text size="3" color="gray">
          One kind: the session cookie that keeps you signed in. Strictly
          necessary, nothing to consent to, so there is no cookie banner.
        </Text>

        <Heading size="4">Your rights</Heading>
        <Text size="3" color="gray">
          You can have a full copy of your data, or have your account and
          everything in it permanently deleted, at any time — both are
          self-serve in Settings → Account, on every plan. The export is one
          JSON file with your profile, follows, watch history, ratings, and
          imports. Deletion is real deletion: the account row cascades
          through everything you created, with no retention copy. If you paid
          through Polar, they keep anonymized order records they are legally
          required to hold as merchant of record. Prefer email? privacy@stubs.tv
          works too.
        </Text>

        <Heading size="4">Lawful basis and contact</Heading>
        <Text size="3" color="gray">
          Account data is processed to provide the service you signed up for
          (contract). Anything optional would be opt-in consent, added to this
          page first. Questions: privacy@stubs.tv.
        </Text>
      </Flex>
    </Container>
  );
}
