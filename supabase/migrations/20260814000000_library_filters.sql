-- Filtering for the library and the feed (docs/plans/library-feed-filtering.md).
--
-- Both surfaces filter on the same series-level predicates, so both need the
-- same fields reachable: the library through series_progress, the feed
-- through up_next. Everything is evaluated in SQL — the 10ms CPU ceiling on
-- the Workers free plan (ADR-0002) rules out fetching a list and narrowing
-- it in the worker.

-- series_progress gains:
--   * status — a plain column on series, which the view already joins.
--   * unwatched_episodes — because PostgREST cannot compare two columns to
--     each other, so "not up to date" is not expressible as
--     aired_episodes > watched_episodes from the client. Computing it here
--     keeps the library on a readable PostgREST chain instead of an RPC,
--     and gives ShowsList one number to render instead of subtracting the
--     two itself.
--
-- The existing shape is preserved as a CTE and the derived column appended,
-- rather than repeating both count() expressions inside a greatest().
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
    s.runtime_min, s.overview, s.status, r.score, p.specials
)
select
  c.*,
  -- Watched can exceed aired when specials are marked but not counted, so
  -- this floors at zero — the same arithmetic ShowsList used to do.
  greatest(c.aired_episodes - c.watched_episodes, 0) as unwatched_episodes
from counted c;

grant select on public.series_progress to authenticated;

-- up_next gains the same filters, plus one of its own.
--
-- Membership is deliberately unchanged: the feed is followed shows only, so
-- there is no "following" filter here — it would be a switch that does
-- nothing. What the feed does get is p_include_watched, which turns it from
-- "what is left to watch" into the full timeline of the shows being
-- followed. The keyset paging is untouched; filters only narrow the
-- candidate set the cursor walks.
--
-- The new `watched` column exists because of that flag: with watched
-- episodes on screen, the client can no longer assume every row is unseen
-- (it did, in two places).
--
-- Nulls are excluded by an active bound rather than kept: a title whose
-- runtime the provider never gave cannot be judged against "under 40
-- minutes", and quietly including it would make the filter a lie. Unfiltered
-- is still unfiltered — a null bound matches everything.
drop function if exists public.up_next(boolean, date, bigint, int);
-- An interim shape of this migration created a nine-parameter version; any
-- environment that ran it must shed that overload too, because two
-- overloads make every named-argument RPC call ambiguous. Elsewhere this
-- drop is a no-op.
drop function if exists
  public.up_next(boolean, date, bigint, int, boolean, text[], int, int, int);

create or replace function public.up_next(
  p_before boolean,
  p_aired date,
  p_id bigint,
  p_limit int default 20,
  p_include_watched boolean default false,
  p_status text[] default null,
  p_rating_min int default null,
  p_rating_max int default null,
  p_runtime_min int default null,
  p_runtime_max int default null
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
  runtime_min int,
  watched boolean
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
           e.name, e.overview, e.aired, e.runtime_min, w.id is not null
      from public.episodes e
      join public.series s on s.id = e.series_id
      join public.follows f
        on f.entity_type = 'series' and f.entity_id = e.series_id
      -- follows, watches and ratings are all filtered by their own RLS
      -- under security invoker, so "not watched" and "my rating" need no
      -- explicit user_id — the same trick the rest of this file uses.
      left join public.watches w
        on w.entity_type = 'episode' and w.entity_id = e.id
      left join public.ratings r
        on r.entity_type = 'series' and r.entity_id = s.id
     where (p_include_watched or w.id is null)
       and e.aired is not null
       and (e.season_number > 0 or v_specials = 'counted')
       and (p_status is null or s.status = any (p_status))
       and (p_rating_min is null or r.score >= p_rating_min)
       and (p_rating_max is null or r.score <= p_rating_max)
       and (p_runtime_min is null or s.runtime_min >= p_runtime_min)
       and (p_runtime_max is null or s.runtime_min <= p_runtime_max)
       and (e.aired, e.id) < (p_aired, coalesce(p_id, 0))
     order by e.aired desc, e.id desc
     limit p_limit;
  else
    return query
    select e.id, s.id, s.name, s.poster_url, e.season_number, e.number,
           e.name, e.overview, e.aired, e.runtime_min, w.id is not null
      from public.episodes e
      join public.series s on s.id = e.series_id
      join public.follows f
        on f.entity_type = 'series' and f.entity_id = e.series_id
      left join public.watches w
        on w.entity_type = 'episode' and w.entity_id = e.id
      left join public.ratings r
        on r.entity_type = 'series' and r.entity_id = s.id
     where (p_include_watched or w.id is null)
       and e.aired is not null
       and (e.season_number > 0 or v_specials = 'counted')
       and (p_status is null or s.status = any (p_status))
       and (p_rating_min is null or r.score >= p_rating_min)
       and (p_rating_max is null or r.score <= p_rating_max)
       and (p_runtime_min is null or s.runtime_min >= p_runtime_min)
       and (p_runtime_max is null or s.runtime_min <= p_runtime_max)
       and (e.aired, e.id) >= (p_aired, coalesce(p_id, 0))
     order by e.aired asc, e.id asc
     limit p_limit;
  end if;
end;
$$;

-- PUBLIC holds EXECUTE on new functions by default, and anon/authenticated
-- inherit it — revoking from those roles alone would be a no-op.
revoke execute on function public.up_next from public;
grant execute on function public.up_next to authenticated;

-- The movies analogue of series_progress: every movie the user has marked
-- seen, with their rating alongside. Membership is the seen mark itself —
-- movies have no follow state and no episode progress, so this view is much
-- simpler, but it exists for the same reason: rating lives in another table,
-- and sorting or filtering by it has to happen in SQL (PostgREST cannot
-- order one table by another's column, and the 10ms CPU ceiling rules out
-- merging in the worker).
--
-- Explicit columns, not m.* — movies.score is provider popularity and would
-- collide confusingly with r.score, which is what "rating" means here.
drop view if exists public.movies_seen;

create view public.movies_seen with (security_invoker = true) as
select
  w.user_id,
  m.id as movie_id,
  m.name,
  m.poster_url,
  m.released,
  m.runtime_min,
  m.overview,
  r.score as rating
from public.watches w
join public.movies m on m.id = w.entity_id
left join public.ratings r
  on r.user_id = w.user_id
  and r.entity_type = 'movie'
  and r.entity_id = m.id
where w.entity_type = 'movie';

grant select on public.movies_seen to authenticated;
