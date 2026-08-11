-- Popularity-ranked search. TVDB's /search returns no relevance signal at
-- all ("Harry Potter" lists fan films before the real ones), but every full
-- title record carries `score`, a popularity figure that separates famous
-- from obscure by orders of magnitude. Cache it on our rows: full ingestion
-- stores it for free, and search backfills any hit still missing one, so a
-- title's score is fetched at most once. Zero means "provider has no score";
-- null means "not fetched yet".
alter table public.series add column score bigint;
alter table public.movies add column score bigint;

-- Resolves a whole batch of search hits in one call. Search pages resolve up
-- to 24 titles; doing that as one RPC instead of 24 keeps the request well
-- inside the Workers free plan's subrequest budget. Reuses resolve_entity so
-- the concurrency-safe stub logic stays in one place.
--
-- p_entities: [{"entity_type": "series", "provider_id": "81189", "name": "…"}]
-- Returns: {"series:81189": 2, …} — keyed "entity_type:provider_id".
create function public.resolve_entities(
  p_provider public.metadata_provider,
  p_entities jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  e jsonb;
  v_out jsonb := '{}'::jsonb;
  v_id bigint;
begin
  for e in select * from jsonb_array_elements(p_entities) loop
    v_id := public.resolve_entity(
      (e->>'entity_type')::public.entity_type,
      p_provider,
      e->>'provider_id',
      e->>'name'
    );
    v_out := v_out
      || jsonb_build_object((e->>'entity_type') || ':' || (e->>'provider_id'), v_id);
  end loop;
  return v_out;
end;
$$;

-- Writes freshly fetched scores for a mixed batch of titles in one call,
-- for the same subrequest-budget reason.
--
-- p_scores: [{"entity_type": "movie", "id": 2, "score": 4122280}]
create function public.set_title_scores(p_scores jsonb)
returns void
language sql
security definer
set search_path = ''
as $$
  update public.series s
     set score = (e->>'score')::bigint
    from jsonb_array_elements(p_scores) e
   where e->>'entity_type' = 'series'
     and s.id = (e->>'id')::bigint;

  update public.movies m
     set score = (e->>'score')::bigint
    from jsonb_array_elements(p_scores) e
   where e->>'entity_type' = 'movie'
     and m.id = (e->>'id')::bigint;
$$;

-- PUBLIC holds EXECUTE on new functions by default, and anon/authenticated
-- inherit it — revoking from those roles alone would be a no-op. Revoking
-- from PUBLIC also removes it from service_role, hence the explicit grants.
revoke execute on function public.resolve_entities from public;
grant execute on function public.resolve_entities to service_role;
revoke execute on function public.set_title_scores from public;
grant execute on function public.set_title_scores to service_role;
