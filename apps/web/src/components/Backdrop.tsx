import Image from "next/image";
import { Box } from "@radix-ui/themes";

/** How far the artwork fades out into the page background at its foot. */
const FADE_HEIGHT = 80;

/** How far the page content rides back up onto the artwork. */
const OVERLAP = 40;

/**
 * Landscape artwork heading a title page on narrow screens, where a portrait
 * poster would eat most of the fold.
 *
 * Runs the full width and sits flush under the nav — the negative top margin
 * cancels the app layout's vertical padding, which otherwise left a band of
 * background between the two. The foot fades into the page background and the
 * content overlaps it slightly, so the image joins the page rather than
 * sitting on it as a separate block.
 *
 * Hidden from the sm breakpoint up, where there is room for the poster beside
 * the text instead.
 */
export function Backdrop({ url, alt }: { url: string; alt: string }) {
  return (
    <Box
      display={{ initial: "block", sm: "none" }}
      style={{
        position: "relative",
        marginTop: "calc(var(--space-5) * -1)",
        marginBottom: -OVERLAP,
      }}
    >
      <Image
        src={url}
        alt={alt}
        width={1920}
        height={1080}
        sizes="100vw"
        priority
        style={{ width: "100%", height: "auto", display: "block" }}
      />
      <Box
        aria-hidden
        style={{
          position: "absolute",
          insetInline: 0,
          bottom: 0,
          height: FADE_HEIGHT,
          background:
            "linear-gradient(to bottom, transparent, var(--page-background))",
          pointerEvents: "none",
        }}
      />
    </Box>
  );
}
