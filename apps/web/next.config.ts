import type { NextConfig } from "next";
import { initOpenNextCloudflareForDev } from "@opennextjs/cloudflare";

// Makes Cloudflare bindings available in `next dev`.
initOpenNextCloudflareForDev();

const nextConfig: NextConfig = {
  // Workspace packages ship as TypeScript source.
  transpilePackages: ["@stubs/metadata", "@stubs/db"],
  experimental: {
    staleTimes: {
      // Every page here is dynamic (they read the session cookie), and Next 16
      // caches dynamic routes on the client for 0s by default — so flipping
      // between the Shows and Movies tabs re-rendered on the server each time.
      // Half a minute of reuse makes that instant and free.
      //
      // Safe because every mutation goes through a server action that calls
      // revalidatePath, which clears the client router cache; the only staleness
      // this can show is a change made from another device.
      dynamic: 30,
    },
  },
  images: {
    // Cloudflare has no Vercel image optimizer; revisit with a Cloudflare
    // Images loader if artwork bandwidth ever becomes a concern (ADR-0002).
    unoptimized: true,
    remotePatterns: [{ protocol: "https", hostname: "artworks.thetvdb.com" }],
  },
};

export default nextConfig;
