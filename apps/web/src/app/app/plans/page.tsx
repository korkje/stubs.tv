import { Callout, Container, Flex, Heading, Text } from "@radix-ui/themes";
import { createClient } from "@/lib/supabase/server";
import { isSelfHosted } from "@/lib/self-hosted";
import { PricingSection } from "@/components/PricingSection";

/**
 * Where read-only accounts pick a plan (the banner and the write guard both
 * point here). Deliberately still reachable on comp/paid — it just says so
 * instead of selling. Self-hosted instances have nothing to sell, but the
 * page stays reachable (old links, muscle memory) and says that instead
 * (ADR-0019).
 */
export default async function PlansPage() {
  if (isSelfHosted()) {
    return (
      <Container size="3" px="4">
        <Flex direction="column" gap="5">
          <Heading size="6">Plans</Heading>
          <Callout.Root color="green">
            <Callout.Text>
              This is a self-hosted instance — every account has full access,
              and there is nothing to pay for here.
            </Callout.Text>
          </Callout.Root>
        </Flex>
      </Container>
    );
  }

  const supabase = await createClient();
  const { data: profile } = await supabase
    .from("profiles")
    .select("plan")
    .maybeSingle();
  const hasAccess = profile?.plan === "comp" || profile?.plan === "paid";

  return (
    <Container size="3" px="4">
      <Flex direction="column" gap="5">
        <Heading size="6">Choose a plan</Heading>
        {hasAccess ? (
          <Callout.Root color="green">
            <Callout.Text>
              You&apos;re all set — your account has full access.
            </Callout.Text>
          </Callout.Root>
        ) : (
          <Text size="3" color="gray">
            Your account is read-only until you pick a plan. Every plan is
            full access — payment runs through Polar, and prices include VAT.
          </Text>
        )}
        <PricingSection />
      </Flex>
    </Container>
  );
}
