-- The calendar feed's "today" now falls where the user's timezone setting
-- says it does (null = UTC, the setting's documented semantics), instead of
-- always UTC. The boundary decides which episodes are *included*, and
-- calendar subscriptions replace content wholesale on every poll — so under
-- UTC-today, a user west of UTC would watch tonight's episode vanish from
-- their calendar during the evening it airs, the moment UTC rolls over.
--
-- plpgsql (was: sql) for the exception guard: profiles.timezone is
-- validated as IANA on write, but a value Postgres's tzdata doesn't know
-- must degrade to UTC, not 500 the feed. create or replace keeps the
-- existing grants (service_role only).

create or replace function public.calendar_feed(p_token uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_user uuid;
  v_specials text;
  v_synopsis text;
  v_timezone text;
  v_today date;
  v_result jsonb;
begin
  select user_id, specials, synopsis_mode, timezone
    into v_user, v_specials, v_synopsis, v_timezone
  from public.profiles
  where calendar_token = p_token;

  -- Unknown token: null, which the route turns into a 404. A known token
  -- with nothing upcoming still returns an empty episodes array below.
  if v_user is null then
    return null;
  end if;

  begin
    v_today := (now() at time zone coalesce(v_timezone, 'UTC'))::date;
  exception when others then
    v_today := current_date;
  end;

  select jsonb_build_object(
    'episodes', coalesce((
      select jsonb_agg(jsonb_build_object(
        'episode_id', e.id,
        'series_id', s.id,
        'series_name', s.name,
        'season_number', e.season_number,
        'episode_number', e.number,
        'episode_name', e.name,
        'overview', case when v_synopsis = 'show' then e.overview end,
        'aired', e.aired
      ) order by e.aired, e.id)
      from public.episodes e
      join public.series s on s.id = e.series_id
      join public.follows f
        on f.entity_type = 'series'
       and f.entity_id = e.series_id
       and f.user_id = v_user
      where e.aired >= v_today
        and e.aired < v_today + interval '12 months'
        and (e.season_number > 0 or v_specials = 'counted')
    ), '[]'::jsonb)
  ) into v_result;

  return v_result;
end;
$$;
