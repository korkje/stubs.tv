-- The hourly sweep picks its work in SQL (ADR-0010).
--
-- /api/refresh read every series follow into the Worker and passed the ids
-- back as one `in()` list. PostgREST caps a read at max_rows (1000) in no
-- fixed order, so past that, followed shows went unrefreshed at random. A
-- long enough list (follows.entity_id has no foreign key, so any signed-in
-- user can add junk rows) overflowed the URL and failed the sweep every
-- hour. The blanket invalidation in lib/metadata/sync.ts had the same cap.

-- "Which series does anyone follow" had no usable index: the primary key
-- leads with user_id.
create index follows_entity_idx on public.follows (entity_type, entity_id);

-- A series whose refresh just failed (the provider erroring on that title)
-- steps aside for a while, so one broken title can't hold a sweep slot every
-- hour. Written by the sweep only; ingestion ignores it.
alter table public.series add column refresh_failed_at timestamptz;

-- The next series due: followed by anyone, stalest (or never fetched)
-- first, skipping recent failures. Junk follows match no series and drop
-- out on their own.
create function public.stale_followed_series(p_limit int)
returns table (id bigint, name text)
language sql
stable
set search_path = ''
as $$
  select s.id, s.name
  from public.series s
  where s.id in (
      select f.entity_id from public.follows f where f.entity_type = 'series'
    )
    and (s.refresh_failed_at is null
         or s.refresh_failed_at < now() - interval '6 hours')
  order by s.fetched_at asc nulls first
  limit least(greatest(p_limit, 0), 100);
$$;

-- Every followed series marked stale in one statement, for when the delta
-- feed can't be trusted (sync.ts). Returns how many rows it touched.
create function public.invalidate_followed_series()
returns integer
language sql
volatile
set search_path = ''
as $$
  with done as (
    update public.series s
       set fetched_at = null
     where s.id in (
         select f.entity_id from public.follows f where f.entity_type = 'series'
       )
    returning 1
  )
  select count(*)::integer from done;
$$;

-- Server only (AGENTS.md: revoke from all three, then grant back).
revoke execute on function
  public.stale_followed_series,
  public.invalidate_followed_series
from public, anon, authenticated;
grant execute on function
  public.stale_followed_series,
  public.invalidate_followed_series
to service_role;
