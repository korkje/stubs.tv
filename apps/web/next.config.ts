import path from "node:path";
import type { NextConfig } from "next";
import { initOpenNextCloudflareForDev } from "@opennextjs/cloudflare";

// Makes Cloudflare bindings available in `next dev`.
initOpenNextCloudflareForDev();

const nextConfig: NextConfig = {
  // Self-contained server for the Docker image (ADR-0021): `next build`
  // emits .next/standalone with only the traced files, run with plain
  // `node apps/web/server.js`. OpenNext sets the same two options itself
  // for the Workers build, so this is a no-op there. The tracing root is
  // the monorepo root so the workspace packages land in the trace.
  output: "standalone",
  outputFileTracingRoot: path.join(__dirname, "../../"),
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
  // Baseline security headers on every response. The CSP is deliberately
  // just frame-ancestors: no other site may frame stubs.tv (one-click
  // settings actions would otherwise be clickjackable). A full script CSP
  // needs nonces for Next's inline scripts and is a separate job. HSTS is
  // left to the edge: sent from here, it would bind every self-hosted
  // instance to HTTPS as well.
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "Content-Security-Policy", value: "frame-ancestors 'none'" },
          { key: "X-Frame-Options", value: "DENY" },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
        ],
      },
    ];
  },
};

export default nextConfig;
