// Wraps the OpenNext-generated worker so the deployment can carry a cron
// trigger next to the HTTP handler (the generated adapter only exports
// fetch). The schedule lives in wrangler.jsonc; the work itself lives in
// /api/refresh, invoked in-process — no network hop, but the same guarded
// route a human could hit for a manual refresh.
//
// Typed structurally rather than with @cloudflare/workers-types: the file
// is bundled by wrangler, not the Next toolchain, and the generated worker
// only exists after a build (hence the ts-ignore on the import).

/* eslint-disable @typescript-eslint/ban-ts-comment */
// @ts-ignore -- generated at build time
import { default as handler } from "./.open-next/worker.js";

interface Env {
  CRON_SECRET?: string;
}

interface Ctx {
  waitUntil(promise: Promise<unknown>): void;
}

const worker = {
  fetch: (request: Request, env: Env, ctx: Ctx) => handler.fetch(request, env, ctx),

  scheduled(controller: { cron?: string }, env: Env, ctx: Ctx) {
    // Two schedules share this handler; the cron expression says which
    // fired. The 5-minute one sweeps open import jobs (a no-op query when
    // there are none); the hourly one refreshes followed-show metadata.
    const path =
      controller?.cron === "*/5 * * * *" ? "/api/import/run" : "/api/refresh";
    const request = new Request(`https://stubs.tv${path}`, {
      headers: { "x-cron-key": env.CRON_SECRET ?? "" },
    });
    ctx.waitUntil(handler.fetch(request, env, ctx));
  },
};

export default worker;
