-- Metadata cache: titles and people fetched from a provider (TheTVDB today).
-- Public-read, service-role-write. Provider IDs are confined to external_ids;
-- everything else in the app uses our internal bigint IDs (ADR-0004).
-- See docs/DATA-MODEL.md.

create type public.entity_type as enum ('series', 'season', 'episode', 'movie', 'person');
create type public.metadata_provider as enum ('tvdb');
create type public.credit_role as enum ('actor', 'director', 'creator', 'writer');

-- fetched_at is the staleness/completeness marker: null means the row is a
-- stub created from a search result, and a full fetch has never run.
-- provider_updated_at mirrors the provider's own "last updated" so the
-- refresh job can skip unchanged records.

create table public.series (
  id bigint generated always as identity primary key,
  name text not null,
  overview text,
  first_aired date,
  status text,
  genres text[] not null default '{}',
  runtime_min int,
  poster_url text,
  provider_updated_at timestamptz,
  fetched_at timestamptz,
  created_at timestamptz not null default now()
);

create table public.seasons (
  id bigint generated always as identity primary key,
  series_id bigint not null references public.series (id) on delete cascade,
  number int not null,
  name text,
  poster_url text,
  unique (series_id, number)
);

-- Episodes are keyed by (series, season number, episode number) rather than
-- by a season FK: the provider returns season numbers inline with episodes,
-- and this natural key makes re-ingestion idempotent. Season 0 is specials.
create table public.episodes (
  id bigint generated always as identity primary key,
  series_id bigint not null references public.series (id) on delete cascade,
  season_number int not null,
  number int not null,
  name text,
  overview text,
  aired date,
  runtime_min int,
  image_url text,
  provider_updated_at timestamptz,
  unique (series_id, season_number, number)
);

create index episodes_series_aired_idx on public.episodes (series_id, aired);

create table public.movies (
  id bigint generated always as identity primary key,
  name text not null,
  overview text,
  released date,
  genres text[] not null default '{}',
  runtime_min int,
  poster_url text,
  provider_updated_at timestamptz,
  fetched_at timestamptz,
  created_at timestamptz not null default now()
);

create table public.people (
  id bigint generated always as identity primary key,
  name text not null,
  image_url text,
  provider_updated_at timestamptz,
  fetched_at timestamptz,
  created_at timestamptz not null default now()
);

-- Populated from Phase 1 slice 2 (people/follows); schema lands now so the
-- metadata migration stays in one piece.
create table public.credits (
  id bigint generated always as identity primary key,
  person_id bigint not null references public.people (id) on delete cascade,
  series_id bigint references public.series (id) on delete cascade,
  movie_id bigint references public.movies (id) on delete cascade,
  role public.credit_role not null,
  character text,
  sort int,
  constraint credits_exactly_one_title check (num_nonnulls(series_id, movie_id) = 1)
);

create unique index credits_series_unique
  on public.credits (person_id, series_id, role, coalesce(character, ''))
  where series_id is not null;

create unique index credits_movie_unique
  on public.credits (person_id, movie_id, role, coalesce(character, ''))
  where movie_id is not null;

-- The provider abstraction boundary. Seasons are addressed by
-- (series_id, number) and so carry no mapping row today; the enum has room.
create table public.external_ids (
  entity_type public.entity_type not null,
  entity_id bigint not null,
  provider public.metadata_provider not null,
  provider_id text not null,
  primary key (provider, entity_type, provider_id),
  unique (entity_type, entity_id, provider)
);

-- Metadata is public, non-personal data: readable by everyone, writable only
-- by the service role (which bypasses RLS — no write policies exist).
-- Note that a policy alone grants nothing: Supabase's defaults give anon and
-- authenticated no SELECT privilege, so the grant below is what makes the
-- read policy effective.
do $$
declare t text;
begin
  foreach t in array array['series', 'seasons', 'episodes', 'movies', 'people', 'credits', 'external_ids']
  loop
    execute format('alter table public.%I enable row level security', t);
    execute format('create policy "Metadata is publicly readable" on public.%I for select using (true)', t);
    execute format('grant select on public.%I to anon, authenticated', t);
    execute format('revoke insert, update, delete on public.%I from anon, authenticated', t);
    -- service_role bypasses RLS but still needs table privileges, and this
    -- project grants none by default — ingestion fails without this.
    execute format('grant select, insert, update, delete on public.%I to service_role', t);
  end loop;
end;
$$;

grant usage, select on all sequences in schema public to service_role;

-- Resolves a provider ID to an internal ID, creating a stub row if needed.
-- Runs in a single transaction so an entity row can never be orphaned
-- without its mapping, and handles two concurrent ingests of the same title.
-- Callable by the service role only.
create function public.resolve_entity(
  p_entity_type public.entity_type,
  p_provider public.metadata_provider,
  p_provider_id text,
  p_name text
)
returns bigint
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_id bigint;
begin
  select entity_id into v_id
    from public.external_ids
   where provider = p_provider
     and entity_type = p_entity_type
     and provider_id = p_provider_id;

  if found then
    return v_id;
  end if;

  case p_entity_type
    when 'series' then
      insert into public.series (name) values (p_name) returning id into v_id;
    when 'movie' then
      insert into public.movies (name) values (p_name) returning id into v_id;
    when 'person' then
      insert into public.people (name) values (p_name) returning id into v_id;
    else
      raise exception 'resolve_entity does not support entity type %', p_entity_type;
  end case;

  insert into public.external_ids (entity_type, entity_id, provider, provider_id)
  values (p_entity_type, v_id, p_provider, p_provider_id)
  on conflict (provider, entity_type, provider_id) do nothing;

  if not found then
    -- A concurrent ingest created the mapping first: discard our stub row
    -- and adopt the winner's ID.
    case p_entity_type
      when 'series' then delete from public.series where id = v_id;
      when 'movie' then delete from public.movies where id = v_id;
      when 'person' then delete from public.people where id = v_id;
    end case;

    select entity_id into v_id
      from public.external_ids
     where provider = p_provider
       and entity_type = p_entity_type
       and provider_id = p_provider_id;
  end if;

  return v_id;
end;
$$;

-- PUBLIC holds EXECUTE on new functions by default, and anon/authenticated
-- inherit it — revoking from those roles alone would be a no-op. Revoking
-- from PUBLIC also removes it from service_role, hence the explicit grant.
revoke execute on function public.resolve_entity from public;
grant execute on function public.resolve_entity to service_role;
