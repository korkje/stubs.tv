-- The up-next rows show a two-line episode synopsis instead of the runtime,
-- so the feed needs episodes.overview in its return set. Adding a column to
-- `returns table` is a signature change, so the function is dropped and
-- recreated (which also drops its grants — they are re-applied below).
drop function public.up_next(boolean, date, bigint, int);

create function public.up_next(
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
       and e.season_number > 0
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
       and e.season_number > 0
       and (e.aired, e.id) >= (p_aired, coalesce(p_id, 0))
     order by e.aired asc, e.id asc
     limit p_limit;
  end if;
end;
$$;

-- PUBLIC holds EXECUTE on new functions by default, and anon/authenticated
-- inherit it — revoking from those roles alone would be a no-op. Revoking
-- from PUBLIC also removes it from service_role, hence the explicit grant.
revoke execute on function public.up_next from public;
grant execute on function public.up_next to authenticated;
