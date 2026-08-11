import Image from "next/image";
import { Box } from "@radix-ui/themes";

/**
 * Landscape artwork across the full width of a phone screen.
 *
 * Rendered outside the page Container so it can reach the edges, and hidden
 * from the sm breakpoint up, where there is room for the portrait poster
 * beside the text instead.
 */
export function Backdrop({ url, alt }: { url: string; alt: string }) {
  return (
    <Box display={{ initial: "block", sm: "none" }} mb="4">
      <Image
        src={url}
        alt={alt}
        width={1920}
        height={1080}
        sizes="100vw"
        priority
        style={{ width: "100%", height: "auto", display: "block" }}
      />
    </Box>
  );
}
