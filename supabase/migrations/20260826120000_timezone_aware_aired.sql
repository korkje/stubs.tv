-- Aired-ness in the user's timezone, not the server's.
--
-- "Has this episode aired?" was computed with bare current_date, which
-- evaluates in the database session's timezone — UTC on Supabase. Aired
-- counts, unseen badges, and bulk marks therefore flipped at UTC midnight:
-- a user in Tokyo saw tonight's episode as unaired for their first nine
-- hours of the day, and a whole-show mark could grab an episode that airs
-- "tomorrow" for a user west of UTC. The calendar feed got per-user
-- timezone handling in 20260820130000_calendar_feed_timezone.sql; this
-- applies the same rule — (now() at time zone coalesce(timezone, 'UTC'))::date
-- — to the three remaining sites: season_progress, series_progress, and
-- mark_episodes_seen. Column shapes are unchanged; only the aired cutoff
-- moves. An unset timezone (or a caller with no profile) falls back to UTC,
-- which is exactly the old behaviour.

-- season_progress: the view is security_invoker and per-caller (watches are
-- joined on auth.uid()), so "today" is the caller's. Profiles RLS means the
-- subquery can only ever see the caller's own row.
drop view if exists public.season_progress;

create view public.season_progress with (security_invoker = true) as
select
  e.series_id,
  e.season_number,
  count(*) as episode_count,
  count(*) filter (
    where e.aired is not null
      and e.aired <= (now() at time zone coalesce(
        (select p.timezone from public.profiles p
         where p.user_id = (select auth.uid())),
        'UTC'))::date
  ) as aired_count,
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

-- series_progress: rows carry their user, and profiles is already joined
-- for the specials setting, so each row's "today" comes from that row's
-- user — right for the caller under RLS, and right per-row for any
-- service-role read that spans users. Otherwise identical to the
-- 20260814000000_library_filters.sql definition.
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
),
counted as (
  select
    us.user_id,
    s.id as series_id,
    us.followed,
    s.name,
    s.poster_url,
    s.first_aired,
    s.runtime_min,
    s.overview,
    s.status,
    r.score as rating,
    count(e.id) filter (
      where (e.season_number > 0 or coalesce(p.specials, 'uncounted') = 'counted')
        and e.aired is not null
        and e.aired <= (now() at time zone coalesce(p.timezone, 'UTC'))::date
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
    s.runtime_min, s.overview, s.status, r.score, p.specials, p.timezone
)
select
  c.*,
  -- Watched can exceed aired when specials are marked but not counted, so
  -- this floors at zero — the same arithmetic ShowsList used to do.
  greatest(c.aired_episodes - c.watched_episodes, 0) as unwatched_episodes
from counted c;

grant select on public.series_progress to authenticated;

-- mark_episodes_seen: the same cutoff decides what a bulk mark may grab.
-- Body otherwise identical to 20260812120000_user_settings.sql.
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
    and e.aired <= (now() at time zone coalesce(
      (select p.timezone from public.profiles p
       where p.user_id = (select auth.uid())),
      'UTC'))::date
  on conflict (user_id, entity_type, entity_id) do nothing;
$$;
