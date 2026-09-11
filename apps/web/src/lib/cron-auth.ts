/**
 * Guard shared by the scheduled-job routes (/api/refresh, /api/import/run).
 * The caller — Cloudflare's cron trigger via custom-worker.ts, the
 * in-process scheduler (ADR-0021), or an operator with curl — presents
 * CRON_SECRET in the `x-cron-key` header. Both sides are hashed and the
 * digests compared in constant time, so the check leaks nothing about the
 * secret's length or prefix. Web Crypto only, so it runs unchanged on
 * Workers and Node.
 */
export async function isCronRequest(request: Request): Promise<boolean> {
  const secret = process.env.CRON_SECRET;
  const provided = request.headers.get("x-cron-key");
  if (!secret || !provided) return false;

  const [a, b] = await Promise.all([sha256(secret), sha256(provided)]);
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a[i] ^ b[i];
  return diff === 0;
}

async function sha256(value: string): Promise<Uint8Array> {
  const digest = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(value)
  );
  return new Uint8Array(digest);
}
