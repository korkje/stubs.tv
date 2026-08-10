# ADR-0005: License under FSL-1.1-Apache-2.0

- Status: accepted
- Date: 2026-08-10

## Context

Goals: source visible in the open; anyone may self-host and modify for free
(durability promise + potential community); only the owner may run it as a
commercial product. No OSI-approved license can forbid commercial use, so
this is "fair source", not open source — and we should say so honestly.

Alternatives: AGPL-3.0 (true open source, but permits paid competitors as
long as they publish source), Elastic License 2.0 (similar effect, no
open-source conversion), PolyForm Noncommercial (forbids even internal
commercial self-hosting — stricter than intended).

## Decision

Functional Source License 1.1 with Apache 2.0 future grant
(FSL-1.1-Apache-2.0), as used by Sentry. Free use, self-hosting,
modification, and contribution; competing commercial products forbidden;
each release automatically becomes Apache-2.0 two years after publication.

## Consequences

- Matches the intent exactly, with a community-goodwill story (eventual
  Apache-2.0).
- Describe the project as **fair source**, never "open source", in marketing.
- Contributions: contributors license their work under the same terms; if
  outside contributions become significant, consider a lightweight CLA.
- License text lives in `LICENSE.md`; copyright line currently "korkje" —
  update to a legal name/entity if one is ever formed.
