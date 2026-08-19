-- GDPR right of access / portability (docs/PRIVACY.md): one function that
-- returns everything we hold about the calling user as a single jsonb
-- document. Built in SQL rather than app code so the export is one
-- round-trip, immune to PostgREST's 1000-row page cap, and cheap on worker
-- CPU no matter how large a watch history gets.
--
-- Titles are joined in as human-readable names (series/season/episode
-- numbers, movie titles, release dates) so the export is meaningful outside
-- this app — internal bigint IDs would be useless to anyone else, and
-- provider IDs stay confined to external_ids (ADR-0004). watched_at is
-- emitted even when null: null is meaningful ("seen, date unknown").
--
-- security invoker: every select below runs under the caller's RLS, so the
-- function can only ever export the caller's own rows.

create or replace function public.export_user_data()
returns jsonb
language sql
stable
security invoker
set search_path = ''
as $$
  select jsonb_build_object(
    'profile', (
      select jsonb_build_object(
        'display_name', p.display_name,
        'plan', p.plan,
        'is_admin', p.is_admin,
        'timezone', p.timezone,
        'specials', p.specials,
        'bulk_mark_specials', p.bulk_mark_specials,
        'synopsis_mode', p.synopsis_mode,
        'created_at', p.created_at
      )
      from public.profiles p
      where p.user_id = (select auth.uid())
    ),
    'billing', (
      select jsonb_build_object(
        'polar_customer_id', b.polar_customer_id,
        'lifetime', b.lifetime,
        'subscription_status', b.subscription_status,
        'current_period_end', b.current_period_end,
        'updated_at', b.updated_at
      )
      from public.billing b
      where b.user_id = (select auth.uid())
    ),
    'follows', coalesce((
      select jsonb_agg(row order by row->>'followed_at')
      from (
        select jsonb_build_object(
          'type', f.entity_type,
          'name', coalesce(s.name, pe.name),
          'followed_at', f.created_at
        ) as row
        from public.follows f
        left join public.series s
          on f.entity_type = 'series' and s.id = f.entity_id
        left join public.people pe
          on f.entity_type = 'person' and pe.id = f.entity_id
        where f.user_id = (select auth.uid())
      ) rows
    ), '[]'::jsonb),
    'watches', coalesce((
      select jsonb_agg(row order by row->>'added_at')
      from (
        select case w.entity_type
          when 'episode' then jsonb_build_object(
            'type', 'episode',
            'series', s.name,
            'season', e.season_number,
            'episode', e.number,
            'title', e.name,
            'aired', e.aired,
            'watched_at', w.watched_at,
            'added_at', w.created_at
          )
          else jsonb_build_object(
            'type', 'movie',
            'title', m.name,
            'released', m.released,
            'watched_at', w.watched_at,
            'added_at', w.created_at
          )
        end as row
        from public.watches w
        left join public.episodes e
          on w.entity_type = 'episode' and e.id = w.entity_id
        left join public.series s on s.id = e.series_id
        left join public.movies m
          on w.entity_type = 'movie' and m.id = w.entity_id
        where w.user_id = (select auth.uid())
      ) rows
    ), '[]'::jsonb),
    'ratings', coalesce((
      select jsonb_agg(row order by row->>'rated_at')
      from (
        select case r.entity_type
          when 'series' then jsonb_build_object(
            'type', 'series',
            'series', s.name,
            'score', r.score,
            'rated_at', r.created_at,
            'updated_at', r.updated_at
          )
          when 'season' then jsonb_build_object(
            'type', 'season',
            'series', ss.name,
            'season', se.number,
            'score', r.score,
            'rated_at', r.created_at,
            'updated_at', r.updated_at
          )
          when 'episode' then jsonb_build_object(
            'type', 'episode',
            'series', es.name,
            'season', e.season_number,
            'episode', e.number,
            'title', e.name,
            'score', r.score,
            'rated_at', r.created_at,
            'updated_at', r.updated_at
          )
          else jsonb_build_object(
            'type', 'movie',
            'title', m.name,
            'score', r.score,
            'rated_at', r.created_at,
            'updated_at', r.updated_at
          )
        end as row
        from public.ratings r
        left join public.series s
          on r.entity_type = 'series' and s.id = r.entity_id
        left join public.seasons se
          on r.entity_type = 'season' and se.id = r.entity_id
        left join public.series ss on ss.id = se.series_id
        left join public.episodes e
          on r.entity_type = 'episode' and e.id = r.entity_id
        left join public.series es on es.id = e.series_id
        left join public.movies m
          on r.entity_type = 'movie' and m.id = r.entity_id
        where r.user_id = (select auth.uid())
      ) rows
    ), '[]'::jsonb),
    -- Import jobs are durable user data (intents outlive the job for
    -- reconciliation and a future rewatch backfill). Matched intents are
    -- already represented by the exported watches, so each job carries only
    -- what exists nowhere else: the summary counters, leftovers that never
    -- became watches, and rewatch counts. The raw `reported`/`report` jsonb
    -- stays out — it is keyed by provider IDs, which are confined to the
    -- ingestion layer (ADR-0004); `counts` carries the same story in plain
    -- numbers.
    'imports', coalesce((
      select jsonb_agg(row order by row->>'created_at')
      from (
        select jsonb_build_object(
          'source', j.source,
          'status', j.status,
          'counts', j.counts,
          'created_at', j.created_at,
          'finished_at', j.finished_at,
          'unmatched_episodes', coalesce((
            select jsonb_agg(jsonb_build_object(
              'series', s.name,
              'season', i.season_number,
              'episode', i.episode_number,
              'watched_at', i.watched_at
            ) order by s.name, i.season_number, i.episode_number)
            from public.import_watch_intents i
            join public.series s on s.id = i.series_id
            where i.job_id = j.id and i.status <> 'matched'
          ), '[]'::jsonb),
          'unmatched_movies', coalesce((
            select jsonb_agg(jsonb_build_object(
              'title', mi.name,
              'year', mi.year,
              'watched_at', mi.watched_at,
              'status', mi.status
            ) order by mi.name)
            from public.import_movie_intents mi
            where mi.job_id = j.id and mi.status <> 'matched'
          ), '[]'::jsonb),
          'rewatches', coalesce((
            select jsonb_agg(jsonb_build_object(
              'series', s.name,
              'season', i.season_number,
              'episode', i.episode_number,
              'times_beyond_first', i.rewatch_count
            ) order by s.name, i.season_number, i.episode_number)
            from public.import_watch_intents i
            join public.series s on s.id = i.series_id
            where i.job_id = j.id and i.rewatch_count > 0
          ), '[]'::jsonb)
        ) as row
        from public.import_jobs j
        where j.user_id = (select auth.uid())
      ) rows
    ), '[]'::jsonb)
  );
$$;

-- PUBLIC holds EXECUTE on new functions and anon/authenticated inherit it,
-- so revoke from public itself, then grant back exactly who needs it.
revoke execute on function public.export_user_data() from public;
grant execute on function public.export_user_data() to authenticated;
grant execute on function public.export_user_data() to service_role;
