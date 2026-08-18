import Link from "next/link";
import {
  Badge,
  Box,
  Button,
  Card,
  Flex,
  Grid,
  Heading,
  Text,
} from "@radix-ui/themes";

type Plan = {
  name: string;
  price: string;
  local: string;
  cadence: string;
  note: string;
  cta: string;
  badge?: string;
  productId: string;
};

/**
 * The three plans, shared by the marketing page and /app/plans. CTAs point
 * at /checkout, which requires login — a logged-out click detours through
 * /login?next=… and comes back (see checkout/route.ts).
 *
 * Product ids come from env because Polar's sandbox and production are
 * separate environments with disjoint ids (ADR-0013). When they are unset
 * (a self-hosted instance without payments) the section renders nothing.
 */
export function PricingSection() {
  const monthly = process.env.POLAR_PRODUCT_MONTHLY;
  const annual = process.env.POLAR_PRODUCT_ANNUAL;
  const lifetime = process.env.POLAR_PRODUCT_LIFETIME;
  if (!monthly || !annual || !lifetime) return null;

  const plans: Plan[] = [
    {
      name: "Monthly",
      price: "$2.95",
      local: "€2.95 · 29 kr",
      cadence: "per month",
      note: "Full access, cancel any time.",
      cta: "Start monthly",
      productId: monthly,
    },
    {
      name: "Annual",
      price: "$24.95",
      local: "€24.95 · 249 kr",
      cadence: "per year",
      note: "Full access, about 30% cheaper than monthly.",
      cta: "Start your free month",
      badge: "First month free",
      productId: annual,
    },
    {
      name: "Lifetime",
      price: "$149.95",
      local: "€149.95 · 1 499 kr",
      cadence: "once",
      note: "Full access, forever. No subscription.",
      cta: "Get lifetime access",
      productId: lifetime,
    },
  ];

  return (
    <Grid columns={{ initial: "1", sm: "3" }} gap="4" width="100%">
      {plans.map((plan) => (
        <Card key={plan.name} size="3">
          <Flex direction="column" gap="3" height="100%">
            <Flex align="center" justify="between" gap="2">
              <Heading size="4">{plan.name}</Heading>
              {plan.badge && <Badge color="amber">{plan.badge}</Badge>}
            </Flex>
            <Box>
              <Flex align="baseline" gap="2">
                <Heading size="7">{plan.price}</Heading>
                <Text size="2" color="gray">
                  {plan.cadence}
                </Text>
              </Flex>
              <Text size="2" color="gray">
                {plan.local}
              </Text>
            </Box>
            <Text size="2" color="gray" style={{ flexGrow: 1 }}>
              {plan.note}
            </Text>
            <Button size="3" asChild variant={plan.badge ? "solid" : "soft"}>
              <Link href={`/checkout?products=${plan.productId}`}>
                {plan.cta}
              </Link>
            </Button>
          </Flex>
        </Card>
      ))}
    </Grid>
  );
}
