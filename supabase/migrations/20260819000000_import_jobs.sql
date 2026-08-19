-- TV Time import (docs/plans/tvtime-import.md, ADR-0015).
--
-- The browser parses the export and POSTs a normalised payload; phase 1
-- persists it here verbatim (plus follows and ratings, pure DB), so the
-- expensive half — metadata ingestion — can run as a resumable background
-- job. Intents are the safety net: an episode TheTVDB has since renumbered
-- stays here as an unmatched row to be *reported*, instead of vanishing.

create table public.import_jobs (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users (id) on delete cascade,
  -- Which reader produced the payload ("tvtime-gdpr-csv", …). Text rather
  -- than an enum so future importers (Trakt, IMDb, CSV) need no migration.
  source text not null,
  status text not null default 'queued'
    check (status in ('queued', 'running', 'done', 'failed')),
  -- Progress and outcome counters, maintained by the worker; shapes are
  -- owned by the app (apps/web/src/lib/import/).
  counts jsonb not null default '{}'::jsonb,
  -- TV Time's own per-show seen counts ({"<tvdb id>": n}), kept solely to
  -- reconcile after ingestion — shortfalls must be visible, never silent.
  reported jsonb not null default '{}'::jsonb,
  -- The client-side parser's report (files used, rows skipped and why).
  -- The archive never reaches the server (ADR-0015), so this is the only
  -- record of what parsing saw.
  report jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  finished_at timestamptz
);

-- One import at a time per account. Deliberately NOT "one import ever":
-- the whole design is idempotent so a fix-and-rerun must stay possible.
create unique index import_jobs_one_open_per_user
  on public.import_jobs (user_id)
  where status in ('queued', 'running');

create index import_jobs_open_idx on public.import_jobs (status, created_at)
  where status in ('queued', 'running');

create table public.import_watch_intents (
  id bigint generated always as identity primary key,
  job_id bigint not null references public.import_jobs (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  -- Internal series id: phase 1 resolves the payload's TVDB ids in one
  -- resolve_entities batch (creating stub rows), so the worker never needs
  -- the provider mapping again.
  series_id bigint not null references public.series (id) on delete cascade,
  -- The export's TheTVDB id, kept for the reconciliation report.
  tvdb_series_id bigint not null,
  season_number int not null,
  episode_number int not null,
  watched_at timestamptz,
  -- Watches beyond the first. watches is unique per (user, entity) — rewatch
  -- tracking is deferred (DATA-MODEL.md) — so this is kept for a later
  -- backfill rather than imported today.
  rewatch_count int not null default 0,
  -- pending -> matched (a watches row exists) | unmatched (the episode does
  -- not exist under this (season, episode) — renumbering, deletions).
  status text not null default 'pending'
    check (status in ('pending', 'matched', 'unmatched')),
  unique (job_id, tvdb_series_id, season_number, episode_number)
);

-- The worker's work queue: distinct pending series per job.
create index import_watch_intents_pending_idx
  on public.import_watch_intents (job_id, series_id)
  where status = 'pending';

-- Films carry no external ids in the GDPR export — title and year is all
-- there is — so they stage here for exact-match auto-acceptance or a manual
-- pick. Only *watched* films are staged: TV Time's to-watch list has no
-- home in this app yet, and pretending otherwise would fake the counts.
create table public.import_movie_intents (
  id bigint generated always as identity primary key,
  job_id bigint not null references public.import_jobs (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  name text not null,
  year int,
  runtime_min int,
  -- Liberator exports do carry movie TVDB ids; the GDPR CSVs never do.
  tvdb_movie_id bigint,
  watched_at timestamptz,
  -- pending -> matched (watch written, movie_id set) | skipped (user chose
  -- to drop it) | unmatched (no candidate found; awaiting a manual pick).
  status text not null default 'pending'
    check (status in ('pending', 'matched', 'skipped', 'unmatched')),
  movie_id bigint references public.movies (id) on delete set null
);

create index import_movie_intents_job_idx
  on public.import_movie_intents (job_id, status);

-- Owner-only access, same shape as follows/watches/ratings: the phase-1
-- server action writes through the authenticated client (RLS applies), the
-- phase-2 worker reads and updates through the service role. Grants are
-- never implicit in this project (AGENTS.md): every policy needs its grant,
-- and service_role can write nothing without one despite bypassing RLS.
do $$
declare t text;
begin
  foreach t in array array['import_jobs', 'import_watch_intents', 'import_movie_intents']
  loop
    execute format('alter table public.%I enable row level security', t);
    execute format(
      'create policy "Users manage their own rows" on public.%I for all '
      'using ((select auth.uid()) = user_id) '
      'with check ((select auth.uid()) = user_id)', t);
    execute format('grant select, insert, update, delete on public.%I to authenticated', t);
    execute format('grant select, insert, update, delete on public.%I to service_role', t);
  end loop;
end;
$$;

-- Identity columns draw from sequences; inserting roles need USAGE on them.
grant usage, select on sequence public.import_jobs_id_seq to authenticated, service_role;
grant usage, select on sequence public.import_watch_intents_id_seq to authenticated, service_role;
grant usage, select on sequence public.import_movie_intents_id_seq to authenticated, service_role;
