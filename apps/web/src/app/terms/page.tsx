import type { Metadata } from "next";
import { Container, Flex, Heading, Text } from "@radix-ui/themes";

export const metadata: Metadata = {
  title: "Terms — stubs.tv",
  description: "The short, plain terms of using stubs.tv.",
};

export default function TermsPage() {
  return (
    <Container size="2" px="4">
      <Flex direction="column" gap="5" py="9">
        <Heading size="7">Terms</Heading>
        <Text size="3" color="gray">
          The short version: pay for a plan, track what you watch, your data
          stays yours. The longer version is still short.
        </Text>

        <Heading size="4">The service</Heading>
        <Text size="3" color="gray">
          stubs.tv is a tracker for movies and TV shows. You need an account,
          and you are responsible for what happens under it. Don&apos;t abuse
          the service — automated scraping, resale of access, or attempts to
          break it are the obvious lines.
        </Text>

        <Heading size="4">Plans and payment</Heading>
        <Text size="3" color="gray">
          Paid plans are sold by Polar, acting as merchant of record — Polar
          is the seller on your receipt, handles VAT, and its terms govern the
          purchase itself. Prices include VAT. Subscriptions renew until you
          cancel in the customer portal (linked from every receipt email);
          cancelling lets the plan run out at the end of the paid period. The
          annual plan&apos;s first month is free — cancel within it and you
          pay nothing. Refund requests go through Polar.
        </Text>

        <Heading size="4">If you stop paying</Heading>
        <Text size="3" color="gray">
          Your account becomes read-only. Nothing is deleted, everything stays
          visible and exportable, and resubscribing turns writing back on.
        </Text>

        <Heading size="4">Your data</Heading>
        <Text size="3" color="gray">
          Your watch history belongs to you: export it or delete it at any
          time (see the privacy page). Deleting your account removes your data
          permanently.
        </Text>

        <Heading size="4">The code</Heading>
        <Text size="3" color="gray">
          stubs.tv is fair source (FSL-1.1-Apache-2.0): the code is public and
          self-hosting for yourself is free and permitted; offering a
          competing commercial service on it is not.
        </Text>

        <Heading size="4">The fine print</Heading>
        <Text size="3" color="gray">
          The service is provided as-is, by a very small team, and features
          may change. If stubs.tv ever shuts down, you will get notice and
          time to export your data — the whole point of the product is that
          your history doesn&apos;t vanish. Liability is limited to what you
          paid in the preceding twelve months. Norwegian law applies. These
          terms may change; material changes will be announced in the app.
        </Text>
      </Flex>
    </Container>
  );
}
