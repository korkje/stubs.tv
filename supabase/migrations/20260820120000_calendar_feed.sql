-- Tokenized iCal feed (docs/plans/ical-feed.md, ADR-0018). Calendar clients
-- cannot sign in, so the URL is the credential: a per-user random token,
-- regenerable when leaked. The route looks the token up through the service
-- role; everything else stays inside calendar_feed() below.

alter table public.profiles
  add column calendar_token uuid not null default gen_random_uuid();

-- Lookups are by token; unique doubles as the collision guard.
create unique index profiles_calendar_token_idx
  on public.profiles (calendar_token);

-- A leaked URL dies by regenerating. A function rather than a column update
-- grant on purpose: the token must always come from gen_random_uuid() —
-- users choosing their own would make it guessable.
create function public.regenerate_calendar_token()
returns uuid
language sql
volatile
security definer
set search_path = ''
as $$
  update public.profiles
  set calendar_token = gen_random_uuid()
  where user_id = (select auth.uid())
  returning calendar_token;
$$;

-- The feed: upcoming episodes (today .. +12 months) of followed series for
-- the token's owner. Distinguishes "unknown token" (zero rows -> the route
-- 404s) from "valid but empty" (an empty episodes array -> a valid, empty
-- calendar). Mirrors up_next's settings handling: specials appear only for
-- specials = 'counted', synopses only for synopsis_mode = 'show' — pushing
-- a spoiler into someone's calendar would defeat the setting, and a
-- scrambled synopsis in a calendar would be absurd, so both other modes
-- omit it.
--
-- security definer: there is no session to invoke RLS as; the token match
-- is the authorization. Future-only rows mean no watch data is exposed —
-- only what the user follows.
create function public.calendar_feed(p_token uuid)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select jsonb_build_object(
    'episodes', coalesce((
      select jsonb_agg(jsonb_build_object(
        'episode_id', e.id,
        'series_id', s.id,
        'series_name', s.name,
        'season_number', e.season_number,
        'episode_number', e.number,
        'episode_name', e.name,
        'overview', case when p.synopsis_mode = 'show' then e.overview end,
        'aired', e.aired
      ) order by e.aired, e.id)
      from public.episodes e
      join public.series s on s.id = e.series_id
      join public.follows f
        on f.entity_type = 'series'
       and f.entity_id = e.series_id
       and f.user_id = p.user_id
      where e.aired >= current_date
        and e.aired < current_date + interval '12 months'
        and (e.season_number > 0 or p.specials = 'counted')
    ), '[]'::jsonb)
  )
  from public.profiles p
  where p.calendar_token = p_token;
$$;

-- PUBLIC holds EXECUTE on new functions and anon/authenticated inherit it,
-- so revoke from PUBLIC itself, then grant back exactly who needs what:
-- the feed is read by the route's service client only; regeneration is a
-- signed-in user acting on their own row.
revoke execute on function public.regenerate_calendar_token from public;
grant execute on function public.regenerate_calendar_token to authenticated;
grant execute on function public.regenerate_calendar_token to service_role;

revoke execute on function public.calendar_feed from public;
grant execute on function public.calendar_feed to service_role;
