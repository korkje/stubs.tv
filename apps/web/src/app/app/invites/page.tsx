import { Container, Flex, Heading } from "@radix-ui/themes";
import { FadeIn } from "@/components/FadeIn";
import { InvitesCard } from "@/components/invites/InvitesCard";

/** Invites moved out of the Library: account plumbing, not media. */
export default function InvitesPage() {
  return (
    <Container size="2" px="4">
      <FadeIn>
        <Flex direction="column" gap="4">
          <Heading size="6">Invites</Heading>
          <InvitesCard />
        </Flex>
      </FadeIn>
    </Container>
  );
}
