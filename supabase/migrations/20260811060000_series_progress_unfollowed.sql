-- Widen series_progress membership: a show belongs in the list when the user
-- follows it OR has watched any of its episodes, not only when followed.
-- Following becomes a flag on the row (`followed`) instead of the entry
-- ticket, so the Shows list can display everything with history and mark the
-- followed ones.
--
-- Membership comes from any watched episode, including specials — a show
-- where only season 0 was watched still appears, with watched_episodes = 0,
-- since progress keeps counting only aired, non-special episodes.
drop view if exists public.series_progress;

create view public.series_progress with (security_invoker = true) as
with user_series as (
  select user_id, series_id, bool_or(followed) as followed
  from (
    select f.user_id, f.entity_id as series_id, true as followed
    from public.follows f
    where f.entity_type = 'series'
    union all
    select w.user_id, e.series_id, false
    from public.watches w
    join public.episodes e on e.id = w.entity_id
    where w.entity_type = 'episode'
  ) u
  group by user_id, series_id
)
select
  us.user_id,
  s.id as series_id,
  us.followed,
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
from user_series us
join public.series s on s.id = us.series_id
left join public.episodes e on e.series_id = s.id
left join public.watches w
  on w.user_id = us.user_id
  and w.entity_type = 'episode'
  and w.entity_id = e.id
left join public.ratings r
  on r.user_id = us.user_id
  and r.entity_type = 'series'
  and r.entity_id = s.id
group by
  us.user_id, s.id, us.followed, s.name, s.poster_url, s.first_aired,
  s.runtime_min, s.overview, r.score;

grant select on public.series_progress to authenticated;
