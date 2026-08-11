-- Carry runtime and the synopsis on series_progress, so the Shows list can
-- render the same row shape as the Movies list without a second query.
drop view if exists public.series_progress;

create view public.series_progress with (security_invoker = true) as
select
  f.user_id,
  s.id as series_id,
  s.name,
  s.poster_url,
  s.first_aired,
  s.runtime_min,
  s.overview,
  r.score as rating,
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
left join public.ratings r
  on r.user_id = f.user_id
  and r.entity_type = 'series'
  and r.entity_id = s.id
where f.entity_type = 'series'
group by
  f.user_id, s.id, s.name, s.poster_url, s.first_aired,
  s.runtime_min, s.overview, r.score;

grant select on public.series_progress to authenticated;
