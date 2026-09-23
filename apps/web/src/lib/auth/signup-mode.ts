/** How long one isolate trusts its answer before asking GoTrue again. */
const CACHE_MS = 5 * 60 * 1000;

let cached: { value: boolean; at: number } | null = null;

/**
 * Whether sign-up sends a confirmation mail, and so whether the password is
 * chosen from that mail rather than on the sign-up form (ADR-0025). Read
 * from GoTrue's public /settings (`mailer_autoconfirm` is true when there's
 * no mail), so an instance without SMTP keeps the password on the form with
 * no configuration of its own.
 *
 * If GoTrue can't be asked, the answer is false: the form then asks for the
 * password as before. That's safe either way, because a confirmation link
 * still asks for the password and replaces whatever sign-up set.
 */
export async function passwordChosenByEmail(
  fetcher: typeof fetch = fetch,
  now: () => number = Date.now
): Promise<boolean> {
  if (cached && now() - cached.at < CACHE_MS) return cached.value;
  try {
    const response = await fetcher(
      `${process.env.NEXT_PUBLIC_SUPABASE_URL}/auth/v1/settings`,
      {
        headers: { apikey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "" },
        cache: "no-store",
      }
    );
    if (!response.ok) return false;
    const settings = (await response.json()) as { mailer_autoconfirm?: unknown };
    const value = settings.mailer_autoconfirm === false;
    cached = { value, at: now() };
    return value;
  } catch {
    return false;
  }
}

/** Test hook: forget the cached answer. */
export function resetPasswordModeCache(): void {
  cached = null;
}
