# ADR-0007: Plain Node + npm as the toolchain

- Status: accepted
- Date: 2026-08-10
- Amends: ADR-0006 (which originally specified pnpm)

## Context

ADR-0006 initially specified pnpm out of habit, but this repo doesn't need
it: the workspace is small (one app, a couple of packages), and every tool
in the stack (Next.js, `@opennextjs/cloudflare`, wrangler) is built and
tested against Node + npm first. Deno was briefly considered — it can run
Next.js — but the deploy pipeline is unproven under it, and the owner
prefers keeping the repo free of runtime-specific configuration. The
production runtime is Cloudflare's `workerd` regardless (ADR-0002), so this
only governs local tooling; boring is best.

## Decision

- **Node (current LTS) + npm**. npm's built-in workspaces tie the monorepo
  together. No pnpm, no Deno-specific files, no extra tooling.
- `package.json` scripts are the task runner (`npm run dev`, etc.).
- Node version pinned via `"engines"` in the root `package.json` and an
  `.nvmrc`, both standard files any environment understands.

## Consequences

- Zero-friction path for every tool in the stack, all contributors, all AI
  agent environments, and self-hosters: `git clone` → `npm install` →
  `supabase start` → `npm run dev`.
- npm workspaces lack pnpm's strictness (hoisting) and speed; irrelevant at
  this repo's size. If install times or phantom dependencies ever actually
  hurt, revisit in a new ADR.
