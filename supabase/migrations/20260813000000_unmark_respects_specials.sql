-- unmark_episodes_seen: the whole-show sweep respects the specials settings,
-- exactly as mark_episodes_seen has since the settings were added. Without
-- this, one "Unmark show" click deletes specials watches that "Mark show"
-- will not put back — with the bulk switch off, the pair silently strips a
-- user's deliberately marked specials. As with marking, unmarking one season
-- explicitly (specials included) is a deliberate act and stays honoured.
create or replace function public.unmark_episodes_seen(
  p_series_id bigint,
  p_season_number int default null
)
returns void
language sql
as $$
  delete from public.watches w
  using public.episodes e
  where w.entity_id = e.id
    and w.entity_type = 'episode'
    and w.user_id = (select auth.uid())
    and e.series_id = p_series_id
    and (p_season_number is null or e.season_number = p_season_number)
    and (
      p_season_number is not null
      or e.season_number > 0
      or (
        select p.bulk_mark_specials and p.specials <> 'hidden'
        from public.profiles p
        where p.user_id = (select auth.uid())
      )
    );
$$;
