-- Lifetime totals for the home page. Aggregated in SQL so the worker never
-- pulls a user's whole history across the wire to count it (10ms CPU budget).
create view public.watch_totals with (security_invoker = true) as
select
  w.user_id,
  count(*) filter (where w.entity_type = 'episode') as episodes_seen,
  count(*) filter (where w.entity_type = 'movie') as movies_seen,
  coalesce(sum(e.runtime_min), 0) + coalesce(sum(m.runtime_min), 0) as minutes_watched
from public.watches w
left join public.episodes e on w.entity_type = 'episode' and e.id = w.entity_id
left join public.movies m on w.entity_type = 'movie' and m.id = w.entity_id
group by w.user_id;

grant select on public.watch_totals to authenticated;
