import Link from "next/link";
import {
  Box,
  Button,
  Card,
  Container,
  Flex,
  Grid,
  Heading,
  Link as RadixLink,
  Section,
  Separator,
  Text,
} from "@radix-ui/themes";
import { PricingSection } from "@/components/PricingSection";
import { StubsMark } from "@/components/StubsMark";

const features = [
  {
    title: "Everything in one place",
    body: "Movies and TV shows together, tracked episode by episode. Mark one episode, a season, or a whole show in a tap — and untap it just as easily.",
  },
  {
    title: "Always know what's next",
    body: "Follow the shows you watch and the feed lines up your unwatched episodes in air-date order. No spoilers — synopses of unwatched episodes can stay hidden.",
  },
  {
    title: "See what it adds up to",
    body: "Watch time, per-show progress, and your history laid out. It's a memory box, not a scoreboard — no streaks, no guilt.",
  },
  {
    title: "Yours, durably",
    body: "stubs.tv exists because a tracking service died and took a decade of watch history with it. Export everything, delete everything, or self-host it — the code is fair source.",
  },
];

const faq = [
  {
    q: "Is there a free trial?",
    a: "The annual plan's first month is free. You add a card at checkout and can cancel any time during the month — cancel before it ends and you pay nothing.",
  },
  {
    q: "Can I bring my TV Time history?",
    a: "Yes — and better than anywhere else. TV Time's export is keyed by TheTVDB ids, the catalogue stubs.tv runs on, so shows and episodes import exactly rather than being fuzzy-matched. The preview is free and runs in your browser.",
  },
  {
    q: "How do I cancel?",
    a: "Through the customer portal — every receipt email links to it. Your plan runs to the end of what you paid for.",
  },
  {
    q: "What happens to my history if I stop paying?",
    a: "Nothing is deleted. Your account becomes read-only: you can see everything and export everything, you just can't add to it until you resubscribe.",
  },
  {
    q: "Can I run it myself?",
    a: "Yes. The code is fair source and self-hosting is free — the repository has instructions.",
  },
];

export default function Home() {
  return (
    <Container size="3" px="4">
      <Flex direction="column" align="center" py="9" gap="2">
        {/* The lockup at full size overflows a phone (120px mark + size-9
            heading is wider than 375px), so both step down together. */}
        <Flex direction="row" align="center" gap={{ initial: "3", sm: "4" }}>
          <Box
            style={{ transform: "rotate(-6deg)" }}
            width={{ initial: "84px", sm: "120px" }}
            flexShrink="0"
          >
            <StubsMark width="100%" />
          </Box>
          <Heading size={{ initial: "8", sm: "9" }}>stubs.tv</Heading>
        </Flex>

        <Flex direction="column" align="center" gap="5" pt="6" maxWidth="520px">
          <Text size="4" color="gray" align="center">
            Keep track of the movies and TV shows you watch, episode by
            episode. See what you have seen, what is left, and how much time
            it added up to.
          </Text>
          <Flex gap="3" pt="2">
            <Button size="3" asChild>
              <Link href="/signup">Create account</Link>
            </Button>
            {/* Deliberately /app, not /login: the middleware sends signed-out
                visitors to the login page, and signed-in ones go straight in —
                without this page (static) having to know who's asking. */}
            <Button size="3" variant="soft" asChild>
              <Link href="/app">Sign in</Link>
            </Button>
          </Flex>
          <Text size="2" color="gray" align="center">
            The annual plan&apos;s first month is free.
          </Text>
        </Flex>
      </Flex>

      <Section size="2">
        <Grid columns={{ initial: "1", sm: "2" }} gap="4">
          {features.map((feature) => (
            <Card key={feature.title} size="3">
              <Flex direction="column" gap="2">
                <Heading size="4">{feature.title}</Heading>
                <Text size="3" color="gray">
                  {feature.body}
                </Text>
              </Flex>
            </Card>
          ))}
        </Grid>
      </Section>

      <Section size="2" id="pricing">
        <Flex direction="column" gap="5">
          <Flex direction="column" gap="2" align="center">
            <Heading size="7">Pricing</Heading>
            <Text size="3" color="gray" align="center">
              Every plan is full access. Prices include VAT — payment runs
              through Polar.
            </Text>
          </Flex>
          <PricingSection />
        </Flex>
      </Section>

      <Section size="2">
        <Flex direction="column" gap="5" maxWidth="640px" mx="auto">
          <Heading size="7" align="center">
            Questions
          </Heading>
          {faq.map((item) => (
            <Flex key={item.q} direction="column" gap="1">
              <Heading size="3">{item.q}</Heading>
              <Text size="3" color="gray">
                {item.a}
              </Text>
            </Flex>
          ))}
        </Flex>
      </Section>

      <Separator size="4" />

      <Flex
        asChild
        direction={{ initial: "column", sm: "row" }}
        align="center"
        justify="between"
        gap="3"
        py="6"
      >
        <footer>
          <Text size="2" color="gray">
            A work in progress by{" "}
            <RadixLink href="https://github.com/korkje" target="_blank" rel="noreferrer">
              korkje
            </RadixLink>{" "}
            and{" "}
            <RadixLink href="https://claude.com/claude-code" target="_blank" rel="noreferrer">
              Claude
            </RadixLink>
            .
          </Text>
          <Flex gap="4">
            <RadixLink asChild size="2" color="gray">
              <Link href="/import/tv-time">TV Time import</Link>
            </RadixLink>
            <RadixLink asChild size="2" color="gray">
              <Link href="/privacy">Privacy</Link>
            </RadixLink>
            <RadixLink asChild size="2" color="gray">
              <Link href="/terms">Terms</Link>
            </RadixLink>
            <RadixLink
              size="2"
              color="gray"
              href="https://github.com/korkje/stubs.tv"
              target="_blank"
              rel="noreferrer"
            >
              Source
            </RadixLink>
          </Flex>
        </footer>
      </Flex>
    </Container>
  );
}
