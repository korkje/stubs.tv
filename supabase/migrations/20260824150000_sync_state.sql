-- Cursor for the /updates-driven metadata sync (docs/plans/metadata-updates.md):
-- one row per provider holding the last fully processed point in the
-- provider's change feed. A table rather than anything in-process because the
-- worker is stateless and invocations must resume where the last one stopped.

create table public.sync_state (
  provider public.metadata_provider primary key,
  -- Where the next sync should read the change feed from. Advanced only
  -- after a run completes; overlapping reads are harmless (invalidation is
  -- idempotent).
  cursor_at timestamptz not null,
  updated_at timestamptz not null default now()
);

-- Internal bookkeeping: no user-facing access at all. RLS on with no
-- policies shuts out anon/authenticated even if a grant ever appears;
-- service_role bypasses RLS but still needs explicit table privileges
-- (this project's Postgres grants none by default — see AGENTS.md).
alter table public.sync_state enable row level security;
grant select, insert, update, delete on public.sync_state to service_role;
