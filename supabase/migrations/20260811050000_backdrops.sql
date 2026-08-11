-- Landscape artwork (1920x1080 backgrounds), shown full-bleed on phones where
-- a portrait poster wastes most of the screen.
alter table public.series add column backdrop_url text;
alter table public.movies add column backdrop_url text;
