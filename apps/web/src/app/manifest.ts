import type { MetadataRoute } from "next";

// Served at /manifest.webmanifest; Next adds the <link rel="manifest"> tag.
// The PNGs live in public/ and are generated from the canonical brand mark
// by scripts/generate-icons.mjs — regenerate rather than editing them.
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "stubs.tv",
    short_name: "stubs.tv",
    description:
      "Keep track of the movies and TV shows you watch, episode by episode.",
    start_url: "/",
    display: "standalone",
    // Matches the light-mode theme-color meta in layout.tsx.
    background_color: "#ffffff",
    theme_color: "#ffffff",
    icons: [
      { src: "/icon-192.png", sizes: "192x192", type: "image/png" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png" },
      {
        src: "/icon-maskable-192.png",
        sizes: "192x192",
        type: "image/png",
        purpose: "maskable",
      },
      {
        src: "/icon-maskable-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
    ],
  };
}
