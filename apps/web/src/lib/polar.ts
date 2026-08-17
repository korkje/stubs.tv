import "server-only";

import { Polar } from "@polar-sh/sdk";

let client: Polar | undefined;

/**
 * Polar SDK client, shared across the checkout and webhook routes.
 *
 * The organization access token already scopes every call to the stubs-tv
 * organization. POLAR_SERVER selects sandbox or production so environments
 * switch with configuration alone — never hardcode the server here.
 */
export function getPolarClient(): Polar {
  if (client) return client;

  const accessToken = process.env.POLAR_ACCESS_TOKEN;
  const server = process.env.POLAR_SERVER;

  if (!accessToken || (server !== "sandbox" && server !== "production")) {
    throw new Error(
      "POLAR_ACCESS_TOKEN and POLAR_SERVER (sandbox|production) must be set for payments"
    );
  }

  client = new Polar({ accessToken, server });
  return client;
}
