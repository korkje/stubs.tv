import { createServerClient } from "@supabase/ssr";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  authCall,
  isVisitorRateLimited,
  limitedFetch,
  RATE_LIMITED,
  RATE_LIMITED_CODE,
  type AuthLimiters,
  type RateLimiter,
  visitorKey,
} from "./rate-limit";

const SUPABASE = "https://abcdefghijklmnopqrst.supabase.co";

/** A limiter that allows `allow` calls per key, recording every key it sees. */
function counter(allow: number) {
  const seen: string[] = [];
  const limiter: RateLimiter = {
    async limit({ key }) {
      seen.push(key);
      return { success: seen.filter((k) => k === key).length <= allow };
    },
  };
  return { limiter, seen };
}

describe("authCall", () => {
  it.each([
    ["/auth/v1/token?grant_type=password", "sign-in"],
    ["/auth/v1/token?grant_type=id_token", "sign-in"],
    ["/auth/v1/token?grant_type=refresh_token", "refresh"],
    ["/auth/v1/token?grant_type=pkce", "code"],
    ["/auth/v1/signup", "sign-up"],
    ["/auth/v1/verify", "verify"],
    ["/auth/v1/recover?redirect_to=https%3A%2F%2Fstubs.tv", "recover"],
    ["/auth/v1/otp", "email"],
    ["/auth/v1/magiclink", "email"],
    ["/auth/v1/resend", "email"],
  ])("counts %s as %s", (path, kind) => {
    expect(authCall(`${SUPABASE}${path}`)).toBe(kind);
  });

  it.each([
    "/auth/v1/user",
    "/auth/v1/logout",
    "/auth/v1/settings",
    "/auth/v1/admin/users/0b6c3f0e",
    "/rest/v1/profiles?select=*",
    "/rest/v1/rpc/ensure_email_identity",
  ])("leaves %s alone", (path) => {
    expect(authCall(`${SUPABASE}${path}`)).toBeNull();
  });

  it("leaves anything that isn't a URL alone", () => {
    expect(authCall("not a url")).toBeNull();
  });
});

describe("visitorKey", () => {
  it.each([
    ["203.0.113.7", "203.0.113.7"],
    [" 198.51.100.23 ", "198.51.100.23"],
    ["::ffff:203.0.113.7", "203.0.113.7"],
    ["2001:db8:abcd:12:3456:789a:bcde:f012", "2001:db8:abcd:12::/64"],
    ["2001:0DB8:ABCD:0012::1", "2001:db8:abcd:12::/64"],
    ["2001:db8::1", "2001:db8:0:0::/64"],
    ["2001:db8:abcd:12::", "2001:db8:abcd:12::/64"],
    ["fe80::1%eth0", "fe80:0:0:0::/64"],
    ["::1", "0:0:0:0::/64"],
    ["64:ff9b::192.0.2.1", "64:ff9b:0:0::/64"],
  ])("keys %s as %s", (ip, key) => {
    expect(visitorKey(ip)).toBe(key);
  });

  it("puts every address in a /64 under one key", () => {
    expect(visitorKey("2001:db8:abcd:12:ffff:ffff:ffff:ffff")).toBe(
      visitorKey("2001:db8:abcd:12::")
    );
    expect(visitorKey("2001:db8:abcd:13::")).not.toBe(
      visitorKey("2001:db8:abcd:12::")
    );
  });

  it.each([
    null,
    undefined,
    "",
    "unknown",
    "256.1.1.1",
    "1.2.3",
    "2001:db8::1::2",
    "2001:db8:1:2:3:4:5:6:7",
    "2001:db8:1:2:3:4:5",
    "2001:db8:gggg::1",
    "::ffff:999.1.1.1",
  ])("has no key for %s", (ip) => {
    expect(visitorKey(ip)).toBeNull();
  });
});

describe("limitedFetch", () => {
  const upstream = vi.fn(async () => new Response("{}"));

  beforeEach(() => {
    upstream.mockClear();
    vi.stubGlobal("fetch", upstream);
  });
  afterEach(() => vi.unstubAllGlobals());

  const limiters =
    (attempts: RateLimiter, refreshes: RateLimiter = attempts) =>
    (): AuthLimiters => ({ attempts, refreshes });

  it("counts each kind of call per visitor, and refreshes separately", async () => {
    const attempts = counter(10);
    const refreshes = counter(10);
    const f = limitedFetch(() => "203.0.113.7", limiters(attempts.limiter, refreshes.limiter));

    await f(`${SUPABASE}/auth/v1/token?grant_type=password`);
    await f(`${SUPABASE}/auth/v1/verify`, { method: "POST" });
    await f(new Request(`${SUPABASE}/auth/v1/recover`, { method: "POST" }));
    await f(new URL(`${SUPABASE}/auth/v1/token?grant_type=refresh_token`));

    expect(attempts.seen).toEqual([
      "sign-in:203.0.113.7",
      "verify:203.0.113.7",
      "recover:203.0.113.7",
    ]);
    expect(refreshes.seen).toEqual(["refresh:203.0.113.7"]);
    expect(upstream).toHaveBeenCalledTimes(4);
  });

  it("answers for GoTrue once the visitor's allowance is spent", async () => {
    const attempts = counter(2);
    const f = limitedFetch(() => "2001:db8:abcd:12::99", limiters(attempts.limiter));
    const url = `${SUPABASE}/auth/v1/verify`;

    expect((await f(url)).status).toBe(200);
    expect((await f(url)).status).toBe(200);
    const refused = await f(url);

    expect(upstream).toHaveBeenCalledTimes(2);
    expect(refused.status).toBe(429);
    expect(refused.headers.get("retry-after")).toBe("60");
    expect(await refused.json()).toMatchObject({ code: RATE_LIMITED_CODE, msg: RATE_LIMITED });
    expect(attempts.seen).toEqual(Array(3).fill("verify:2001:db8:abcd:12::/64"));
  });

  it("gives another visitor their own allowance", async () => {
    const attempts = counter(1);
    let ip = "203.0.113.7";
    const f = limitedFetch(() => ip, limiters(attempts.limiter));
    const url = `${SUPABASE}/auth/v1/signup`;

    await f(url);
    expect((await f(url)).status).toBe(429);
    ip = "203.0.113.8";
    expect((await f(url)).status).toBe(200);
  });

  it("never counts calls Supabase doesn't limit", async () => {
    const attempts = counter(0);
    const visitorIp = vi.fn(() => "203.0.113.7");
    const f = limitedFetch(visitorIp, limiters(attempts.limiter));

    await f(`${SUPABASE}/auth/v1/user`);
    await f(`${SUPABASE}/rest/v1/watches?select=*`);

    expect(attempts.seen).toEqual([]);
    expect(visitorIp).not.toHaveBeenCalled();
    expect(upstream).toHaveBeenCalledTimes(2);
  });

  it("passes calls through when there's no limiter or no visitor address", async () => {
    const deny = counter(0);
    const url = `${SUPABASE}/auth/v1/token?grant_type=password`;

    await limitedFetch(() => "203.0.113.7", () => null)(url);
    await limitedFetch(() => "203.0.113.7", () => ({}))(url);
    await limitedFetch(() => null, limiters(deny.limiter))(url);
    await limitedFetch(async () => "garbage", limiters(deny.limiter))(url);

    expect(deny.seen).toEqual([]);
    expect(upstream).toHaveBeenCalledTimes(4);
  });

  it("lets calls through when the limiter itself fails", async () => {
    const broken: RateLimiter = {
      limit: async () => {
        throw new Error("binding unavailable");
      },
    };
    const error = vi.spyOn(console, "error").mockImplementation(() => {});
    const f = limitedFetch(() => "203.0.113.7", limiters(broken));

    expect((await f(`${SUPABASE}/auth/v1/verify`)).status).toBe(200);
    expect(error).toHaveBeenCalledOnce();
    error.mockRestore();
  });
});

describe("a refused call, as the Supabase SDK reports it", () => {
  const upstream = vi.fn(async () => new Response("{}"));

  beforeEach(() => {
    upstream.mockClear();
    vi.stubGlobal("fetch", upstream);
  });
  afterEach(() => vi.unstubAllGlobals());

  /** A server client like lib/supabase/server.ts builds, over an in-memory jar. */
  function client(jar: Map<string, string> = new Map()) {
    const deny = counter(0).limiter;
    return createServerClient(SUPABASE, "sb_publishable_test", {
      global: {
        fetch: limitedFetch(() => "203.0.113.7", () => ({ attempts: deny, refreshes: deny })),
      },
      cookies: {
        getAll: () => [...jar].map(([name, value]) => ({ name, value })),
        setAll: (cookies) =>
          cookies.forEach(({ name, value }) =>
            value ? jar.set(name, value) : jar.delete(name)
          ),
      },
    });
  }

  function expectRefused(error: unknown) {
    expect(error).toMatchObject({ status: 429, code: RATE_LIMITED_CODE, message: RATE_LIMITED });
    expect(isVisitorRateLimited(error as { code?: string })).toBe(true);
  }

  it("is an auth error with our code, from every limited entry point", async () => {
    const auth = client().auth;

    expectRefused((await auth.signInWithPassword({ email: "a@example.com", password: "x" })).error);
    expectRefused((await auth.signUp({ email: "a@example.com", password: "long enough" })).error);
    expectRefused((await auth.verifyOtp({ type: "email", token_hash: "abc" })).error);
    expectRefused((await auth.resetPasswordForEmail("a@example.com")).error);
    expect(upstream).not.toHaveBeenCalled();
  });

  it("covers the OAuth code exchange", async () => {
    const jar = new Map([["sb-abcdefghijklmnopqrst-auth-token-code-verifier", "base64-" + Buffer.from(JSON.stringify("verifier")).toString("base64url")]]);
    expectRefused((await client(jar).auth.exchangeCodeForSession("code")).error);
    expect(upstream).not.toHaveBeenCalled();
  });

  it("covers the session refresh, which then ends the expired session", async () => {
    const session = {
      access_token: "expired",
      refresh_token: "refresh",
      token_type: "bearer",
      expires_in: 3600,
      expires_at: Math.floor(Date.now() / 1000) - 60,
      user: { id: "00000000-0000-0000-0000-000000000000" },
    };
    const name = "sb-abcdefghijklmnopqrst-auth-token";
    const jar = new Map([[name, "base64-" + Buffer.from(JSON.stringify(session)).toString("base64url")]]);

    const { data, error } = await client(jar).auth.getUser();

    expect(data.user).toBeNull();
    expect(error).not.toBeNull();
    expect(upstream).not.toHaveBeenCalled();
    // The same as GoTrue refusing it: the session is gone and must be signed
    // into again. Which is why the refresh allowance is the generous one.
    expect(jar.has(name)).toBe(false);
  });
});
