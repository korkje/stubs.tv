import type { TvdbEnvelope } from "./dto";

const BASE_URL = "https://api4.thetvdb.com/v4";

export class TvdbError extends Error {
  constructor(
    message: string,
    readonly status: number
  ) {
    super(message);
    this.name = "TvdbError";
  }
}

/**
 * Minimal TheTVDB v4 client. Bearer tokens last a month, so one is cached per
 * instance and renewed on the first 401 rather than tracked by expiry.
 */
export class TvdbClient {
  #token: string | null = null;
  #pendingLogin: Promise<string> | null = null;

  constructor(private readonly apiKey: string) {
    if (!apiKey) throw new Error("TVDB API key is required");
  }

  async #login(): Promise<string> {
    // Collapse concurrent logins so a cold start with parallel requests
    // performs one handshake, not one per request.
    this.#pendingLogin ??= (async () => {
      const response = await fetch(`${BASE_URL}/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ apikey: this.apiKey }),
      });

      if (!response.ok) {
        throw new TvdbError(`TVDB login failed: ${response.status}`, response.status);
      }

      const body = (await response.json()) as TvdbEnvelope<{ token?: string }>;
      const token = body.data?.token;
      if (!token) throw new TvdbError("TVDB login returned no token", 500);

      this.#token = token;
      return token;
    })().finally(() => {
      this.#pendingLogin = null;
    });

    return this.#pendingLogin;
  }

  /** GET a path relative to the API root, retrying once if the token expired. */
  async get<T>(path: string): Promise<TvdbEnvelope<T> | null> {
    let token = this.#token ?? (await this.#login());

    let response = await this.#request(path, token);

    if (response.status === 401) {
      this.#token = null;
      token = await this.#login();
      response = await this.#request(path, token);
    }

    // A missing title is an expected outcome, not an error.
    if (response.status === 404) return null;

    if (!response.ok) {
      throw new TvdbError(`TVDB request failed (${response.status}): ${path}`, response.status);
    }

    return (await response.json()) as TvdbEnvelope<T>;
  }

  #request(path: string, token: string): Promise<Response> {
    return fetch(`${BASE_URL}${path}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
  }
}
