/**
 * A job's share of one import-worker invocation (/api/import/run). Each
 * open job gets an even split of the time left after the reserve, worked
 * out as the job starts, so one large import can't hold the whole run
 * while newer ones queue behind it. A job that finishes early leaves its
 * unused share to the jobs after it, and a lone job gets everything.
 *
 * The clock reads like the invocation's own `timeLeft`, so the worker's
 * "stop below the reserve" checks work unchanged: it drops below the
 * reserve once the share is spent or the invocation runs short, whichever
 * comes first.
 */
export function jobClock(
  timeLeft: () => number,
  jobsRemaining: number,
  reserveMs: number,
  now: () => number = Date.now
): () => number {
  const share = Math.max(0, timeLeft() - reserveMs) / Math.max(1, jobsRemaining);
  const end = now() + share;
  return () => Math.min(timeLeft(), end - now() + reserveMs);
}
