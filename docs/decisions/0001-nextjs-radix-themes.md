# ADR-0001: Next.js (TypeScript) with Radix UI Themes

- Status: accepted
- Date: 2026-08-10

## Context

Fullstack TypeScript webapp, worked on from multiple AI-agent environments,
by a solo owner who values a simple, polished UI without building a design
system. The owner prefers Radix UI **Themes** (the full component library,
not just headless Radix primitives).

## Decision

- Next.js (App Router) with TypeScript `strict: true` as the single
  fullstack framework — pages, API routes, and server components in one app.
- Radix UI Themes as the only component library. Its theming tokens are the
  design system; custom CSS is a last resort, a second component library is
  off the table.

## Consequences

- Huge ecosystem and agent familiarity; SSR/ISR for marketing pages free.
- Radix Themes covers forms, dialogs, tables, layout — expected to be
  sufficient for a tracking app's UI. If a needed component is missing, build
  it from headless Radix primitives styled with Theme tokens.
- Next.js couples us loosely to Vercel-shaped conventions; ADR-0002 covers
  how it runs on Cloudflare instead.
