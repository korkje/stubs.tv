-- User tracking: follows, watches and ratings. All owner-scoped via RLS.
-- See docs/DATA-MODEL.md for the reasoning behind the shape.

create table public.follows (
  user_id uuid not null references auth.users (id) on delete cascade,
  entity_type public.entity_type not null,
  entity_id bigint not null,
  created_at timestamptz not null default now(),
  primary key (user_id, entity_type, entity_id),
  constraint follows_followable check (entity_type in ('series', 'person'))
);

create table public.watches (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users (id) on delete cascade,
  entity_type public.entity_type not null,
  entity_id bigint not null,
  -- Null means "seen, date unknown". Bulk marks (a whole season or show) must
  -- leave this null rather than stamping now(), otherwise backfilled history
  -- is indistinguishable from real viewing in the activity analytics.
  watched_at timestamptz,
  created_at timestamptz not null default now(),
  constraint watches_watchable check (entity_type in ('episode', 'movie')),
  -- Keeps "mark as seen" idempotent. Relaxing this (plus a way to tell rows
  -- apart) is all that rewatch support needs.
  unique (user_id, entity_type, entity_id)
);

create index watches_user_watched_at_idx on public.watches (user_id, watched_at);

-- Separate from watches on purpose: a score belongs to the title, not to one
-- viewing of it, and can be given at series/season/episode/film granularity.
create table public.ratings (
  user_id uuid not null references auth.users (id) on delete cascade,
  entity_type public.entity_type not null,
  entity_id bigint not null,
  score smallint not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (user_id, entity_type, entity_id),
  constraint ratings_rateable check (entity_type in ('series', 'season', 'episode', 'movie')),
  constraint ratings_score_range check (score between 1 and 10)
);

-- Per-show progress for the dashboard. security_invoker makes the underlying
-- RLS apply as the querying user, so this exposes nobody else's history.
--
-- Progress deliberately counts only aired, non-special episodes: unaired ones
-- are not yet watchable, and counting specials would leave shows looking
-- permanently unfinished (The Wire alone has 26). Bulk "mark all" still covers
-- specials — that is about marking, not about progress.
create view public.series_progress with (security_invoker = true) as
select
  f.user_id,
  s.id as series_id,
  s.name,
  s.poster_url,
  count(e.id) filter (
    where e.season_number > 0 and e.aired is not null and e.aired <= current_date
  ) as aired_episodes,
  count(w.id) filter (where e.season_number > 0) as watched_episodes
from public.follows f
join public.series s on s.id = f.entity_id
left join public.episodes e on e.series_id = s.id
left join public.watches w
  on w.user_id = f.user_id
  and w.entity_type = 'episode'
  and w.entity_id = e.id
where f.entity_type = 'series'
group by f.user_id, s.id, s.name, s.poster_url;

grant select on public.series_progress to authenticated;

-- Owner-only access. Note that the policy is only half the story: without the
-- matching grant these tables would be unreadable, since this project's
-- defaults give authenticated no table privileges at all.
do $$
declare t text;
begin
  foreach t in array array['follows', 'watches', 'ratings']
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
