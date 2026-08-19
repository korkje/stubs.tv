import type { NextConfig } from "next";
import { initOpenNextCloudflareForDev } from "@opennextjs/cloudflare";

// Makes Cloudflare bindings available in `next dev`.
initOpenNextCloudflareForDev();

const nextConfig: NextConfig = {
  // Workspace packages ship as TypeScript source.
  transpilePackages: ["@stubs/metadata", "@stubs/db", "@stubs/tvtime-import"],
  // Lets `next dev` be reached through `tailscale serve` for testing on a
  // phone (dev-only: the option only affects the dev server's origin checks
  // on /_next/* assets and HMR). Next's `*` matches a single dot-separated
  // label, and a tailnet hostname is machine.tailnet.ts.net — two labels —
  // so it must be `**`, which matches any depth.
  allowedDevOrigins: ["**.ts.net"],
  experimental: {
    serverActions: {
      // The TV Time import commit posts the whole normalised payload in one
      // action call (ADR-0015: the archive itself never leaves the browser).
      // A 20k-episode history serialises to a couple of MB, over the 1 MB
      // default. The commit action still enforces its own row caps.
      bodySizeLimit: "8mb",
    },
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
