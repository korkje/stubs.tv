-- Performance work for large shows. The Workers free plan allows 10ms of CPU
-- per request, and series pages were doing far too much per render.

-- Avoids a PostgREST `in.(...)` filter listing every episode id of a series
-- (~875 for The Simpsons) just to find which are watched.
create view public.watched_episodes with (security_invoker = true) as
select
  w.user_id,
  e.series_id,
  e.id as episode_id,
  e.season_number,
  w.watched_at
from public.watches w
join public.episodes e on e.id = w.entity_id
where w.entity_type = 'episode';

grant select on public.watched_episodes to authenticated;

-- Per-season counts, so a series page can render its season list without
-- pulling every episode row across the wire and reducing over it in the
-- worker. The Simpsons goes from 875 rows to about 40.
create view public.season_progress with (security_invoker = true) as
select
  e.series_id,
  e.season_number,
  count(*) as episode_count,
  count(*) filter (where e.aired is not null and e.aired <= current_date) as aired_count,
  count(w.id) as seen_count,
  coalesce(sum(e.runtime_min), 0) as runtime_min,
  coalesce(sum(e.runtime_min) filter (where w.id is not null), 0) as seen_runtime_min
from public.episodes e
left join public.watches w
  on w.entity_id = e.id
  and w.entity_type = 'episode'
  and w.user_id = (select auth.uid())
group by e.series_id, e.season_number;

grant select on public.season_progress to authenticated;

-- Bulk marking used to serialise every episode id into the page so the client
-- could send them back. Doing the selection in the database instead keeps the
-- payload to two numbers and the work to one round trip.
--
-- security invoker (the default) means RLS still applies and auth.uid() is the
-- calling user, so these cannot touch anyone else's history.

create function public.mark_episodes_seen(
  p_series_id bigint,
  p_season_number int default null
)
returns void
language sql
as $$
  insert into public.watches (user_id, entity_type, entity_id, watched_at)
  select (select auth.uid()), 'episode', e.id, null
  from public.episodes e
  where e.series_id = p_series_id
    and (p_season_number is null or e.season_number = p_season_number)
    -- Never pre-mark something that has not aired: it would count as seen
    -- the moment it comes out and never surface as something to watch.
    and e.aired is not null
    and e.aired <= current_date
  on conflict (user_id, entity_type, entity_id) do nothing;
$$;

create function public.unmark_episodes_seen(
  p_series_id bigint,
  p_season_number int default null
)
returns void
language sql
as $$
  delete from public.watches w
  using public.episodes e
  where w.entity_id = e.id
    and w.entity_type = 'episode'
    and w.user_id = (select auth.uid())
    and e.series_id = p_series_id
    and (p_season_number is null or e.season_number = p_season_number);
$$;

revoke execute on function public.mark_episodes_seen from public;
revoke execute on function public.unmark_episodes_seen from public;
grant execute on function public.mark_episodes_seen to authenticated;
grant execute on function public.unmark_episodes_seen to authenticated;
