import Image from "next/image";
import { Flex, Text } from "@radix-ui/themes";

const ASPECT = 1.5; // posters are 2:3

/** Title artwork, falling back to a neutral placeholder when none exists. */
export function Poster({
  url,
  alt,
  width = 140,
}: {
  url: string | null;
  alt: string;
  width?: number;
}) {
  const height = Math.round(width * ASPECT);

  if (!url) {
    return (
      <Flex
        align="center"
        justify="center"
        style={{
          width,
          height,
          flexShrink: 0,
          borderRadius: "var(--radius-3)",
          background: "var(--gray-3)",
        }}
      >
        <Text size="1" color="gray">
          No image
        </Text>
      </Flex>
    );
  }

  return (
    <Image
      src={url}
      alt={alt}
      width={width}
      height={height}
      style={{
        borderRadius: "var(--radius-3)",
        objectFit: "cover",
        flexShrink: 0,
        background: "var(--gray-3)",
      }}
    />
  );
}
