import type { NextConfig } from "next";
import { initOpenNextCloudflareForDev } from "@opennextjs/cloudflare";

// Makes Cloudflare bindings available in `next dev`.
initOpenNextCloudflareForDev();

const nextConfig: NextConfig = {};

export default nextConfig;
