import { getCloudflareContext } from "@opennextjs/cloudflare";

/**
 * Per-visitor limits in front of Supabase Auth (ADR-0026).
 *
 * Every GoTrue call runs in the Worker, and Cloudflare gives all of a
 * Worker's requests to another Cloudflare site one shared address. Supabase
 * therefore sees every stubs.tv visitor as the same IP, so its per-IP limits
 * work out as limits for the whole site. One visitor could spend everyone's
 * allowance, and some of it (email-link verification, reset requests) is
 * counted before any CAPTCHA check. So the Worker counts each visitor itself,
 * by the address Cloudflare saw, before a call goes out.
 */

/** The header Cloudflare sets to the visitor's address. Clients can't forge it
 * on stubs.tv, because Cloudflare overwrites it. */
export const VISITOR_IP_HEADER = "cf-connecting-ip";

/** A Workers Rate Limiting binding (`ratelimits` in wrangler.jsonc). */
export interface RateLimiter {
  limit(options: { key: string }): Promise<{ success: boolean }>;
}

/** The limits are set on the bindings in wrangler.jsonc. */
export interface AuthLimiters {
  /** Sign-in, sign-up, verification, reset emails and code exchange. */
  attempts?: RateLimiter;
  /** Session refreshes, which any signed-in request can trigger. */
  refreshes?: RateLimiter;
}

/** The allowances a GoTrue call can spend, one counter per visitor each. */
export type AuthCall =
  | "sign-in"
  | "sign-up"
  | "verify"
  | "recover"
  | "email"
  | "code"
  | "refresh";

/** Our code for a refused call, kept apart from GoTrue's own rate-limit codes.
 * Those can depend on the address asked about, so they're shown differently. */
export const RATE_LIMITED_CODE = "visitor_rate_limited";

export const RATE_LIMITED =
  "Too many attempts from your network. Wait a minute, then try again.";

export function isVisitorRateLimited(
  error: { code?: string } | null | undefined
): boolean {
  return error?.code === RATE_LIMITED_CODE;
}

/**
 * The allowance a request to GoTrue spends. Returns null for the calls
 * Supabase doesn't limit per IP, such as reading the user, signing out or
 * admin calls.
 */
export function authCall(url: string): AuthCall | null {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return null;
  }
  switch (parsed.pathname) {
    case "/auth/v1/token":
      switch (parsed.searchParams.get("grant_type")) {
        case "refresh_token":
          return "refresh";
        case "pkce":
          return "code";
        default:
          return "sign-in";
      }
    case "/auth/v1/signup":
      return "sign-up";
    case "/auth/v1/verify":
      return "verify";
    case "/auth/v1/recover":
      return "recover";
    case "/auth/v1/otp":
    case "/auth/v1/magiclink":
    case "/auth/v1/resend":
      return "email";
    default:
      return null;
  }
}

const IPV4 =
  /^(25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)(\.(25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)){3}$/;

/**
 * The limiter key for a visitor's address. IPv4 is used whole. IPv6 is cut to
 * its /64, because one household or phone usually holds a whole /64 and
 * could otherwise start over from a fresh address. Returns null for anything
 * that isn't an address.
 */
export function visitorKey(ip: string | null | undefined): string | null {
  const address = ip?.trim().split("%")[0].toLowerCase();
  if (!address) return null;
  if (IPV4.test(address)) return address;
  if (!address.includes(":")) return null;

  const mapped = /^::ffff:([\d.]+)$/.exec(address);
  if (mapped && IPV4.test(mapped[1])) return mapped[1];

  const halves = address.split("::");
  if (halves.length > 2) return null;
  const head = halves[0] ? halves[0].split(":") : [];
  const tail = halves.length === 2 && halves[1] ? halves[1].split(":") : [];

  // An IPv4 tail, as in 64:ff9b::192.0.2.1, is two groups in dotted form.
  const last = tail.length ? tail : head;
  if (last.length && last[last.length - 1].includes(".")) {
    const v4 = last.pop()!;
    if (!IPV4.test(v4)) return null;
    const [a, b, c, d] = v4.split(".").map(Number);
    last.push(((a << 8) | b).toString(16), ((c << 8) | d).toString(16));
  }

  const missing = 8 - head.length - tail.length;
  if (halves.length === 1 ? missing !== 0 : missing < 1) return null;
  const groups = [...head, ...Array<string>(halves.length === 2 ? missing : 0).fill("0"), ...tail];
  if (!groups.every((group) => /^[0-9a-f]{1,4}$/.test(group))) return null;

  return `${groups
    .slice(0, 4)
    .map((group) => parseInt(group, 16).toString(16))
    .join(":")}::/64`;
}

type VisitorIp = () =>
  | string
  | null
  | undefined
  | Promise<string | null | undefined>;

/**
 * fetch for a Supabase client. A GoTrue call that spends a per-IP allowance
 * first spends one of the visitor's own. Once that's used up, the call is
 * answered here with a 429 shaped like GoTrue's, so the SDK reports it as a
 * normal auth error. Everything else passes straight through. So does every
 * call made without a limiter or a visitor address, such as in next dev,
 * Node self-hosting or background work.
 */
export function limitedFetch(
  visitorIp: VisitorIp,
  limiters: () => AuthLimiters | null = workerLimiters
): typeof fetch {
  return async (input, init) => {
    const call = authCall(requestUrl(input));
    if (call && !(await allowed(call, visitorIp, limiters))) {
      return rateLimitedResponse();
    }
    return fetch(input, init);
  };
}

async function allowed(
  call: AuthCall,
  visitorIp: VisitorIp,
  limiters: () => AuthLimiters | null
): Promise<boolean> {
  const bound = limiters();
  const limiter = call === "refresh" ? bound?.refreshes : bound?.attempts;
  if (!limiter) return true;
  const visitor = visitorKey(await visitorIp());
  if (!visitor) return true;
  try {
    const { success } = await limiter.limit({ key: `${call}:${visitor}` });
    return success;
  } catch (error) {
    // A guard, not a gate: a broken counter must not lock everyone out.
    console.error(
      `auth rate limiter failed: ${error instanceof Error ? error.message : String(error)}`
    );
    return true;
  }
}

function requestUrl(input: RequestInfo | URL): string {
  if (typeof input === "string") return input;
  if (input instanceof URL) return input.href;
  return input.url;
}

/**
 * GoTrue's own error shape. The version header makes the SDK read `code`
 * (older responses carry `error_code`), and `msg` becomes the message.
 */
function rateLimitedResponse(): Response {
  return Response.json(
    { code: RATE_LIMITED_CODE, error_code: RATE_LIMITED_CODE, msg: RATE_LIMITED },
    {
      status: 429,
      headers: { "x-supabase-api-version": "2024-01-01", "retry-after": "60" },
    }
  );
}

/** The limiters bound to this Worker, or null when not running in one. */
function workerLimiters(): AuthLimiters | null {
  try {
    const env = getCloudflareContext().env as {
      AUTH_ATTEMPTS?: RateLimiter;
      AUTH_REFRESHES?: RateLimiter;
    };
    return { attempts: env.AUTH_ATTEMPTS, refreshes: env.AUTH_REFRESHES };
  } catch {
    // Node self-hosting (ADR-0021) has no Cloudflare context.
    return null;
  }
}
