-- User settings, stored as typed columns on profiles (three real settings do
-- not justify a JSON blob; RLS and the per-column update grant are already
-- in place). Each one turns a decision the app made by default into the
-- user's choice:
--
--   timezone            where the Up Next "Today" line falls (null = UTC)
--   specials            'hidden'    - specials nowhere: not listed, counted,
--                                     bulk-marked or in the feed
--                       'uncounted' - the current behaviour: listed and
--                                     bulk-markable but not counted in
--                                     progress and not in the feed
--                       'counted'   - the completionist: counted in progress
--                                     and part of the feed
--   bulk_mark_specials  whether "Mark show" touches specials (moot when
--                       specials are hidden)
--   synopsis_mode       'show' | 'scramble' (scrambled until revealed, per
--                       episode) | 'hide' — spoiler protection for synopses
--                       of unwatched episodes

alter table public.profiles
  add column timezone text,
  add column specials text not null default 'uncounted'
    check (specials in ('hidden', 'uncounted', 'counted')),
  add column bulk_mark_specials boolean not null default true,
  add column synopsis_mode text not null default 'show'
    check (synopsis_mode in ('show', 'scramble', 'hide'));

grant update (display_name, timezone, specials, bulk_mark_specials, synopsis_mode)
  on public.profiles to authenticated;

-- series_progress: count specials when the user counts them. The profiles
-- join sees only the invoker's row (RLS), so this stays per-user.
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
    where (e.season_number > 0 or coalesce(p.specials, 'uncounted') = 'counted')
      and e.aired is not null and e.aired <= current_date
  ) as aired_episodes,
  count(w.id) filter (
    where e.season_number > 0 or coalesce(p.specials, 'uncounted') = 'counted'
  ) as watched_episodes
from user_series us
join public.series s on s.id = us.series_id
left join public.profiles p on p.user_id = us.user_id
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
  s.runtime_min, s.overview, r.score, p.specials;

grant select on public.series_progress to authenticated;

-- up_next: include specials in the feed for 'counted' users.
create or replace function public.up_next(
  p_before boolean,
  p_aired date,
  p_id bigint,
  p_limit int default 20
)
returns table (
  episode_id bigint,
  series_id bigint,
  series_name text,
  poster_url text,
  season_number int,
  episode_number int,
  episode_name text,
  overview text,
  aired date,
  runtime_min int
)
language plpgsql
stable
security invoker
set search_path = ''
as $$
declare
  v_specials text := coalesce(
    (select specials from public.profiles where user_id = (select auth.uid())),
    'uncounted'
  );
begin
  if p_before then
    return query
    select e.id, s.id, s.name, s.poster_url, e.season_number, e.number,
           e.name, e.overview, e.aired, e.runtime_min
      from public.episodes e
      join public.series s on s.id = e.series_id
      join public.follows f
        on f.entity_type = 'series' and f.entity_id = e.series_id
      left join public.watches w
        on w.entity_type = 'episode' and w.entity_id = e.id
     where w.id is null
       and e.aired is not null
       and (e.season_number > 0 or v_specials = 'counted')
       and (e.aired, e.id) < (p_aired, coalesce(p_id, 0))
     order by e.aired desc, e.id desc
     limit p_limit;
  else
    return query
    select e.id, s.id, s.name, s.poster_url, e.season_number, e.number,
           e.name, e.overview, e.aired, e.runtime_min
      from public.episodes e
      join public.series s on s.id = e.series_id
      join public.follows f
        on f.entity_type = 'series' and f.entity_id = e.series_id
      left join public.watches w
        on w.entity_type = 'episode' and w.entity_id = e.id
     where w.id is null
       and e.aired is not null
       and (e.season_number > 0 or v_specials = 'counted')
       and (e.aired, e.id) >= (p_aired, coalesce(p_id, 0))
     order by e.aired asc, e.id asc
     limit p_limit;
  end if;
end;
$$;

-- mark_episodes_seen: a whole-show mark respects the specials settings.
-- Marking one season explicitly (specials included) stays a deliberate act
-- and is honoured as such — the setting governs only the show-wide sweep.
create or replace function public.mark_episodes_seen(
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
    and (
      p_season_number is not null
      or e.season_number > 0
      or (
        select p.bulk_mark_specials and p.specials <> 'hidden'
        from public.profiles p
        where p.user_id = (select auth.uid())
      )
    )
    -- Never pre-mark something that has not aired: it would count as seen
    -- the moment it comes out and never surface as something to watch.
    and e.aired is not null
    and e.aired <= current_date
  on conflict (user_id, entity_type, entity_id) do nothing;
$$;
