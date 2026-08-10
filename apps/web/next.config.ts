import type { NextConfig } from "next";
import { initOpenNextCloudflareForDev } from "@opennextjs/cloudflare";

// Makes Cloudflare bindings available in `next dev`.
initOpenNextCloudflareForDev();

const nextConfig: NextConfig = {
  // Workspace packages ship as TypeScript source.
  transpilePackages: ["@stubs/metadata", "@stubs/db"],
  images: {
    // Cloudflare has no Vercel image optimizer; revisit with a Cloudflare
    // Images loader if artwork bandwidth ever becomes a concern (ADR-0002).
    unoptimized: true,
    remotePatterns: [{ protocol: "https", hostname: "artworks.thetvdb.com" }],
  },
};

export default nextConfig;
