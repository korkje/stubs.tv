# ADR-0004: TheTVDB as sole metadata provider, behind an abstraction

- Status: accepted
- Date: 2026-08-10

## Context

We need TV *and* movie metadata. The owner holds a TheTVDB v4 free API key
(permitted while revenue < $50k/yr, including commercial use). TMDB has
stronger movie data, but its free API is non-commercial only — using it in a
paid product would require negotiating their commercial license.

## Decision

TheTVDB v4 is the only metadata provider for now — it covers both TV and
movies under one legally clean key. All metadata access goes through a
`MetadataProvider` interface; app entities use internal IDs, with provider
IDs isolated in an `external_ids` mapping table.

## Consequences

- One ingestion pipeline to build and maintain; no licensing questions when
  paid plans launch (until revenue approaches $50k/yr — revisit then).
- Movie metadata quality may lag TMDB's; acceptable for MVP.
- Adding TMDB (or IMDb IDs, etc.) later means implementing the same
  interface and adding `external_ids` rows — **no migration of user data**.
- Hard rule for all code: TVDB IDs and TVDB response shapes never leak past
  the ingestion layer (`packages/metadata`).
