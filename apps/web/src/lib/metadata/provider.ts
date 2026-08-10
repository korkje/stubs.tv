import "server-only";

import { createTvdbProvider, type MetadataProvider } from "@stubs/metadata";

let cached: MetadataProvider | null = null;

/**
 * The metadata provider for this deployment. Everything downstream depends on
 * the MetadataProvider interface rather than this function's concrete choice,
 * so adding a second provider later does not ripple outwards (ADR-0004).
 */
export function getMetadataProvider(): MetadataProvider {
  if (cached) return cached;

  const apiKey = process.env.TVDB_API_KEY;
  if (!apiKey) throw new Error("TVDB_API_KEY is not set");

  cached = createTvdbProvider(apiKey);
  return cached;
}
