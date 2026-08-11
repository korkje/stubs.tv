import Image from "next/image";
import { Box } from "@radix-ui/themes";

/**
 * Landscape artwork heading a title page on narrow screens, where a portrait
 * poster would eat most of the fold. Sits inside the page margins with the
 * same rounding as the cards below it; hidden from the sm breakpoint up,
 * where there is room for the poster beside the text instead.
 */
export function Backdrop({ url, alt }: { url: string; alt: string }) {
  return (
    <Box display={{ initial: "block", sm: "none" }}>
      <Image
        src={url}
        alt={alt}
        width={1920}
        height={1080}
        sizes="100vw"
        priority
        style={{
          width: "100%",
          height: "auto",
          display: "block",
          borderRadius: "var(--radius-4)",
        }}
      />
    </Box>
  );
}
